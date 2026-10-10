/**
 * firebase-service.js - Firebase Authentication & Realtime Database Sync
 * Supports Realtime Listeners, Email/Password & Google Auth, with Smart Offline Fallback.
 */

class FirebaseService {
  constructor() {
    this.isInitialized = false;
    this.auth = null;
    this.database = null;
    this.currentUser = null;
    this.dbRef = null;
    this.syncActive = false;
    this.isSyncingFromCloud = false;
  }

  /**
   * Initialize Firebase with user configuration
   */
  async init(config) {
    const activeConfig = config || (window.getActiveFirebaseConfig ? window.getActiveFirebaseConfig() : null);

    if (!activeConfig || !activeConfig.apiKey) {
      console.log('Firebase not configured. Operating in Offline / LocalStorage Mode.');
      this.updateStatusBadge(false, 'الوضع المحلي (Offline)');
      return false;
    }

    try {
      if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK not loaded on page.');
        this.updateStatusBadge(false, 'مكتبة Firebase غير متوفرة');
        return false;
      }

      // Initialize or get default app
      let app;
      if (!firebase.apps.length) {
        app = firebase.initializeApp(activeConfig);
      } else {
        app = firebase.app();
      }

      this.auth = firebase.auth();
      
      // Realtime Database (if databaseURL is provided)
      if (activeConfig.databaseURL) {
        this.database = firebase.database();
      } else if (activeConfig.projectId) {
        // Fallback default RTDB URL format
        activeConfig.databaseURL = `https://${activeConfig.projectId}-default-rtdb.firebaseio.com`;
        try {
          this.database = firebase.database();
        } catch (e) {
          console.warn('Realtime database not found at default URL:', e);
        }
      }

      this.isInitialized = true;

      // Listen to Auth State
      this.auth.onAuthStateChanged(user => {
        this.currentUser = user;
        if (user) {
          const displayName = user.displayName || user.email.split('@')[0];
          this.updateStatusBadge(true, `متصل: ${displayName}`);
          this.startRealtimeSync();
        } else {
          this.updateStatusBadge(false, 'غير مسجل الدخول سحابياً');
          this.stopRealtimeSync();
        }

        if (window.ui && typeof window.ui.updateAuthUI === 'function') {
          window.ui.updateAuthUI(user);
        }
      });

      return true;
    } catch (err) {
      console.error('Firebase Initialization Error:', err);
      this.updateStatusBadge(false, 'خطأ في إعدادات السحابة');
      return false;
    }
  }

  /**
   * Realtime Database Sync Listener
   */
  startRealtimeSync() {
    if (!this.database || !this.currentUser || this.syncActive) return;

    try {
      const userRef = this.database.ref(`users/${this.currentUser.uid}/ecommerce_data`);
      this.dbRef = userRef;
      this.syncActive = true;

      userRef.on('value', snapshot => {
        const val = snapshot.val();
        if (val && (val.businesses || val.sales || val.expenses)) {
          // Sync cloud data to local store without re-triggering cloud upload
          this.isSyncingFromCloud = true;
          if (Array.isArray(val.businesses)) store.state.businesses = val.businesses;
          if (Array.isArray(val.sales)) store.state.sales = val.sales;
          if (Array.isArray(val.expenses)) store.state.expenses = val.expenses;
          
          store.save(); // writes to local storage & notifies UI
          this.isSyncingFromCloud = false;
        } else if (!val) {
          // Cloud empty, push existing local state to cloud
          this.syncLocalToCloud();
        }
      }, err => {
        console.error('Firebase Realtime listener error (Check Security Rules):', err);
        if (window.ui) {
          window.ui.showToast('تنبيه: تعذرت قراءة البيانات السحابية. يرجى التحقق من قواعد أمان Realtime Database.', 'warning');
        }
      });

      console.log('Realtime synchronization active with Firebase RTDB.');
    } catch (e) {
      console.error('Error starting realtime sync:', e);
    }
  }

  stopRealtimeSync() {
    if (this.dbRef) {
      this.dbRef.off();
      this.dbRef = null;
    }
    this.syncActive = false;
  }

  /**
   * Push current store state to Firebase RTDB
   */
  async syncLocalToCloud() {
    if (this.isSyncingFromCloud) return;
    if (!this.database || !this.currentUser) return;

    try {
      this.updateStatusBadge(true, 'جاري المزامنة... ⏳');
      await this.database.ref(`users/${this.currentUser.uid}/ecommerce_data`).set({
        businesses: store.state.businesses || [],
        sales: store.state.sales || [],
        expenses: store.state.expenses || [],
        lastSyncedAt: new Date().toISOString()
      });

      const displayName = this.currentUser.displayName || this.currentUser.email.split('@')[0];
      this.updateStatusBadge(true, `متصل: ${displayName}`);

      if (window.ui) {
        window.ui.showToast('تمت المزامنة السحابية اللحظية بنجاح ☁️', 'success');
      }
    } catch (e) {
      console.error('Failed to sync to cloud (Check RTDB Rules):', e);
      this.updateStatusBadge(false, 'خطأ في المزامنة السحابية');
      if (window.ui) {
        window.ui.showToast('فشل حفظ البيانات سحابياً. تأكد من صلاحيات وقواعد Realtime Database.', 'error');
      }
    }
  }

  /**
   * Authentication methods
   */
  async loginEmailPassword(email, password) {
    if (!this.auth) {
      throw new Error('الرجاء إدخال إعدادات Firebase وحفظها أولاً.');
    }
    if (!email || !password) {
      throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
    }
    try {
      return await this.auth.signInWithEmailAndPassword(email.trim(), password);
    } catch (error) {
      throw new Error(this.getReadableAuthError(error));
    }
  }

  async registerEmailPassword(email, password) {
    if (!this.auth) {
      throw new Error('الرجاء إدخال إعدادات Firebase وحفظها أولاً.');
    }
    if (!email || !password) {
      throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
    }
    try {
      return await this.auth.createUserWithEmailAndPassword(email.trim(), password);
    } catch (error) {
      throw new Error(this.getReadableAuthError(error));
    }
  }

  async loginWithGoogle() {
    if (!this.auth) {
      throw new Error('الرجاء إدخال إعدادات Firebase وحفظها أولاً.');
    }
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      return await this.auth.signInWithPopup(provider);
    } catch (error) {
      throw new Error(this.getReadableAuthError(error));
    }
  }

  async resetPassword(email) {
    if (!this.auth) {
      throw new Error('الرجاء إدخال إعدادات Firebase وحفظها أولاً.');
    }
    if (!email) {
      throw new Error('يرجى إدخال البريد الإلكتروني لإرسال رابط الاستعادة.');
    }
    try {
      return await this.auth.sendPasswordResetEmail(email.trim());
    } catch (error) {
      throw new Error(this.getReadableAuthError(error));
    }
  }

  async logout() {
    if (!this.auth) return;
    try {
      await this.auth.signOut();
      this.stopRealtimeSync();
      this.updateStatusBadge(false, 'الوضع المحلي (Offline)');
      if (window.ui) {
        window.ui.showToast('تم تسجيل الخروج بنجاح. أنت الآن بالوضع المحلي.', 'info');
      }
    } catch (e) {
      console.error('Logout error:', e);
    }
  }

  updateStatusBadge(isOnline, text) {
    const indicator = document.getElementById('syncIndicator');
    const label = document.getElementById('syncLabel');
    if (indicator) {
      if (isOnline) {
        indicator.classList.add('online');
      } else {
        indicator.classList.remove('online');
      }
    }
    if (label) {
      label.textContent = text;
    }
  }

  getReadableAuthError(error) {
    const code = error.code || '';
    switch(code) {
      case 'auth/invalid-email':
        return 'صيغة البريد الإلكتروني غير صحيحة.';
      case 'auth/user-disabled':
        return 'تم تعطيل هذا الحساب من قِبل المشرف.';
      case 'auth/user-not-found':
        return 'لا يوجد حساب مسجل بهذا البريد الإلكتروني.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'بيانات الدخول غير صحيحة، يرجى التأكد من البريد وكلمة المرور.';
      case 'auth/email-already-in-use':
        return 'هذا البريد الإلكتروني مسجل بالفعل، يرجى تسجيل الدخول بدلاً من ذلك.';
      case 'auth/weak-password':
        return 'كلمة المرور ضعيفة جداً. يجب أن تتكون من 6 خانات أو أحرف على الأقل.';
      case 'auth/network-request-failed':
        return 'تعذر الاتصال بالشبكة، يرجى التحقق من اتصال الإنترنت الخاص بك.';
      case 'auth/popup-closed-by-user':
        return 'تم إغلاق نافذة تسجيل الدخول بجوجل قبل إتمام الدخول.';
      case 'auth/operation-not-allowed':
        return 'طريقة تسجيل الدخول هذه غير مفعلة في لوحة تحكم Firebase (Authentication -> Sign-in method).';
      case 'auth/too-many-requests':
        return 'تم إرسال محاولات كثيرة جداً، يرجى الانتظار قليلاً والمحاولة لاحقاً.';
      default:
        return error.message || 'حدث خطأ أثناء الاتصال بخدمة المصادقة.';
    }
  }
}

// Global Firebase Instance
const firebaseService = new FirebaseService();
