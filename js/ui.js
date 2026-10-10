/**
 * ui.js - UI Rendering, Visuals, Charts, and Navigation Manager
 */

class UIManager {
  constructor() {
    this.salesChart = null;
    this.expensesChart = null;
  }

  init() {
    this.setupNavigation();
    this.setupModals();
    this.renderAll();

    // Check startup auth & guest state
    const isGuest = sessionStorage.getItem('guestMode') === 'true';
    if (isGuest) {
      this.hideAuthScreen();
      this.updateGuestBanner(true);
    } else {
      this.showAuthScreen();
      this.updateGuestBanner(false);
    }
  }

  /* ==========================================================================
     SPA NAVIGATION
     ========================================================================== */
  setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link-custom');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetSection = link.getAttribute('data-section');
        this.navigateTo(targetSection);
        
        // Close sidebar on mobile
        document.getElementById('appSidebar').classList.remove('show');
        document.getElementById('sidebarBackdrop').classList.remove('show');
      });
    });

    // Mobile Sidebar Toggle
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('closeSidebarBtn');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => {
        document.getElementById('appSidebar').classList.add('show');
        backdrop.classList.add('show');
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.getElementById('appSidebar').classList.remove('show');
        backdrop.classList.remove('show');
      });
    }
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        document.getElementById('appSidebar').classList.remove('show');
        backdrop.classList.remove('show');
      });
    }

    // Handle initial hash if any
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`section-${hash}`)) {
      this.navigateTo(hash);
    }
  }

  navigateTo(sectionId) {
    // Hide all sections
    document.querySelectorAll('.spa-section').forEach(sec => sec.classList.remove('active'));
    
    // Deactivate nav links
    document.querySelectorAll('.sidebar-nav .nav-link-custom').forEach(link => link.classList.remove('active'));

    // Show target section
    const targetEl = document.getElementById(`section-${sectionId}`);
    if (targetEl) {
      targetEl.classList.add('active');
    }

    // Activate corresponding link
    const activeLink = document.querySelector(`.sidebar-nav .nav-link-custom[data-section="${sectionId}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }

    // Update Topbar Title
    const titleMap = {
      'dashboard': { title: 'لوحة التحكم والإحصائيات', icon: 'bi-grid-1x2-fill' },
      'businesses': { title: 'المشاريع والبزنسات النشطة', icon: 'bi-briefcase-fill' },
      'add-business': { title: 'إضافة مشروع تجاري جديد', icon: 'bi-plus-circle-fill' },
      'sales': { title: 'إدارة ومتابعة المبيعات', icon: 'bi-cart-check-fill' },
      'expenses': { title: 'سجل المصروفات التشغيلية', icon: 'bi-wallet2' },
      'reports': { title: 'التقارير المالية والتحليل', icon: 'bi-bar-chart-line-fill' },
      'archive': { title: 'أرشيف المشاريع المغلقة', icon: 'bi-archive-fill' },
      'settings': { title: 'الإعدادات والمزامنة السحابية', icon: 'bi-gear-fill' }
    };

    const info = titleMap[sectionId] || titleMap['dashboard'];
    const titleEl = document.getElementById('topbarTitle');
    if (titleEl) {
      titleEl.innerHTML = `<i class="bi ${info.icon}"></i> <span>${info.title}</span>`;
    }

    window.location.hash = sectionId;

    // Refresh charts or specific modules on navigation
    if (sectionId === 'dashboard') {
      setTimeout(() => this.renderDashboardCharts(), 100);
    } else if (sectionId === 'settings') {
      this.populateFirebaseSettingsInputs();
    }
  }

  setupModals() {
    this.businessDetailModal = new bootstrap.Modal(document.getElementById('businessDetailModal'));
    this.saleModal = new bootstrap.Modal(document.getElementById('saleModal'));
    this.expenseModal = new bootstrap.Modal(document.getElementById('expenseModal'));
    this.payDebtModal = new bootstrap.Modal(document.getElementById('payDebtModal'));
    this.receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
    const authModalEl = document.getElementById('authModal');
    if (authModalEl) {
      this.authModal = new bootstrap.Modal(authModalEl);
    }
    const guideModalEl = document.getElementById('systemGuideModal');
    if (guideModalEl) {
      this.systemGuideModal = new bootstrap.Modal(guideModalEl);
    }
  }

  /* ==========================================================================
     STARTUP AUTH SCREEN & GUEST MODE CONTROLLERS
     ========================================================================== */
  showAuthScreen() {
    const authOverlay = document.getElementById('authScreenOverlay');
    const appWrapper = document.getElementById('appWrapper');
    if (authOverlay) authOverlay.classList.remove('d-none');
    if (appWrapper) appWrapper.style.display = 'none';
  }

  hideAuthScreen() {
    const authOverlay = document.getElementById('authScreenOverlay');
    const appWrapper = document.getElementById('appWrapper');
    if (authOverlay) authOverlay.classList.add('d-none');
    if (appWrapper) appWrapper.style.display = 'flex';
  }

  updateGuestBanner(isGuest) {
    const banner = document.getElementById('guestModeBanner');
    if (banner) {
      if (isGuest) {
        banner.classList.remove('d-none');
        banner.classList.add('d-flex');
      } else {
        banner.classList.add('d-none');
        banner.classList.remove('d-flex');
      }
    }
  }

  /* ==========================================================================
     GLOBAL RENDER
     ========================================================================== */
  renderAll() {
    this.renderDashboardKPIs();
    this.renderDashboardRecentSales();
    this.renderDashboardBizProgress();
    this.renderDashboardCharts();
    this.renderActiveBusinesses();
    this.renderClosedBusinesses();
    this.renderSalesTable();
    this.renderExpensesTable();
    this.renderReports();
    this.populateDropdowns();
    this.updateActiveBadge();
  }

  updateActiveBadge() {
    const activeCount = store.state.businesses.filter(b => b.status === 'active').length;
    const badge = document.getElementById('activeBizBadge');
    if (badge) badge.textContent = activeCount;
  }

  formatMoney(num) {
    const val = parseFloat(num);
    if (isNaN(val)) return '0';

    // التقريب لأقرب عدد صحيح فقط بدون أي فواصل عشرية أو فواصل آلاف
    return Math.round(val).toString();
  }

  /* ==========================================================================
     1. DASHBOARD MODULE
     ========================================================================== */
  renderDashboardKPIs() {
    const stats = store.getGlobalDashboardStats();

    document.getElementById('kpiTotalCapital').textContent = this.formatMoney(stats.totalCapital);
    document.getElementById('kpiActiveBizCount').textContent = stats.activeBusinessesCount;

    document.getElementById('kpiTotalSales').textContent = this.formatMoney(stats.totalSalesRevenue);
    document.getElementById('kpiCollectedAmount').textContent = `${this.formatMoney(stats.totalCollected)} د.ل`;

    document.getElementById('kpiTotalExpenses').textContent = this.formatMoney(stats.totalExpenses);

    // Net Profit & Profit Margin Indicator
    const profitEl = document.getElementById('kpiNetProfit');
    const profitContainer = document.getElementById('kpiNetProfitContainer');
    const marginBadge = document.getElementById('kpiProfitMarginBadge');
    const marginEl = document.getElementById('kpiProfitMargin');
    const profitIcon = document.getElementById('kpiProfitIcon');

    profitEl.textContent = this.formatMoney(stats.netProfit);
    marginEl.textContent = `${stats.profitMargin}%`;

    if (stats.netProfit >= 0) {
      profitContainer.className = 'stat-value text-success';
      profitIcon.className = 'stat-icon green';
      profitIcon.innerHTML = '<i class="bi bi-graph-up-arrow"></i>';
      marginBadge.className = 'stat-badge profit-positive';
    } else {
      profitContainer.className = 'stat-value text-danger';
      profitIcon.className = 'stat-icon red';
      profitIcon.innerHTML = '<i class="bi bi-graph-down-arrow"></i>';
      marginBadge.className = 'stat-badge profit-negative';
    }

    document.getElementById('kpiStockValue').textContent = this.formatMoney(stats.remainingStockValue);
    document.getElementById('kpiTotalDebts').textContent = this.formatMoney(stats.totalDebts);
  }

  renderDashboardRecentSales() {
    const tbody = document.getElementById('dashboardRecentSalesTable');
    if (!tbody) return;

    const recent = store.state.sales.slice(0, 5);
    if (recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">لا توجد مبيعات مسجلة حتى الآن</td></tr>`;
      return;
    }

    tbody.innerHTML = recent.map(sale => {
      let badge = '';
      if (sale.paymentStatus === 'paid') {
        badge = '<span class="badge badge-paid-full">مدفوع</span>';
      } else if (sale.paymentStatus === 'partial') {
        badge = '<span class="badge badge-paid-partial">جزئي</span>';
      } else {
        badge = '<span class="badge badge-paid-debt">بالأجل</span>';
      }

      return `
        <tr>
          <td><span class="font-monospace text-success">${sale.invoiceNo}</span></td>
          <td>${sale.businessName}</td>
          <td>${sale.customerName}</td>
          <td><span class="badge bg-dark">${sale.quantity} قطعة</span></td>
          <td class="fw-bold">${this.formatMoney(sale.totalAmount)} د.ل</td>
          <td>${badge}</td>
        </tr>
      `;
    }).join('');
  }

  renderDashboardBizProgress() {
    const container = document.getElementById('dashboardBizProgressList');
    if (!container) return;

    const active = store.state.businesses.filter(b => b.status === 'active').slice(0, 4);
    if (active.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-muted">لا توجد مشاريع نشطة حالياً</div>`;
      return;
    }

    container.innerHTML = active.map(biz => {
      const metrics = store.getBusinessMetrics(biz.id);
      const isLow = metrics.stockSoldPercent > 80;
      const fillClass = metrics.remainingQuantity === 0 ? 'empty' : (isLow ? 'low' : '');

      return `
        <div class="mb-3 p-2 rounded" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle);">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="fw-bold text-white fs-6">${biz.name}</span>
            <span class="text-success small fw-bold">${metrics.soldQuantity} / ${biz.totalQuantity} مباع (${metrics.stockSoldPercent}%)</span>
          </div>
          <div class="stock-progress-bar mb-2">
            <div class="stock-progress-fill ${fillClass}" style="width: ${metrics.stockSoldPercent}%;"></div>
          </div>
          <div class="d-flex justify-content-between small text-muted">
            <span>صافي الربح: <strong class="${metrics.realizedNetProfit >= 0 ? 'text-success' : 'text-danger'}">${this.formatMoney(metrics.realizedNetProfit)} د.ل</strong></span>
            <span>المتبقي بالمخزن: <strong>${metrics.remainingQuantity} قطعة</strong></span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderDashboardCharts() {
    // 1. Sales Trend Chart
    const salesCanvas = document.getElementById('salesTrendChart');
    if (salesCanvas) {
      const ctx = salesCanvas.getContext('2d');
      if (this.salesChart) this.salesChart.destroy();

      // Aggregate monthly data
      const monthly = {};
      const monthsOrder = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('ar-LY', { month: 'short', year: 'numeric' });
        monthly[key] = { label, sales: 0, cogs: 0, profit: 0 };
        monthsOrder.push(key);
      }

      store.state.sales.forEach(s => {
        const key = s.saleDate.substring(0, 7);
        if (monthly[key]) {
          monthly[key].sales += (s.totalAmount || 0);
          monthly[key].cogs += (s.cogs || 0);
          monthly[key].profit += (s.netProfit || 0);
        }
      });

      const labels = monthsOrder.map(k => monthly[k].label);
      const salesData = monthsOrder.map(k => monthly[k].sales);
      const cogsData = monthsOrder.map(k => monthly[k].cogs);
      const profitData = monthsOrder.map(k => monthly[k].profit);

      this.salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'المبيعات (د.ل)',
              data: salesData,
              backgroundColor: 'rgba(16, 185, 129, 0.7)',
              borderColor: '#10b981',
              borderWidth: 1,
              borderRadius: 6
            },
            {
              label: 'تكلفة البضاعة COGS (د.ل)',
              data: cogsData,
              backgroundColor: 'rgba(6, 182, 212, 0.6)',
              borderColor: '#06b6d4',
              borderWidth: 1,
              borderRadius: 6
            },
            {
              label: 'صافي الربح (د.ل)',
              data: profitData,
              backgroundColor: 'rgba(0, 255, 136, 0.9)',
              borderColor: '#00ff88',
              borderWidth: 1,
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: '#94a3b8', font: { family: 'Cairo' } }
            }
          },
          scales: {
            x: {
              ticks: { color: '#94a3b8', font: { family: 'Cairo' } },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            },
            y: {
              ticks: { color: '#94a3b8', font: { family: 'Cairo' } },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            }
          }
        }
      });
    }

    // 2. Expenses Distribution Chart
    const expCanvas = document.getElementById('expensesDistributionChart');
    if (expCanvas) {
      const ctx = expCanvas.getContext('2d');
      if (this.expensesChart) this.expensesChart.destroy();

      const catMap = {
        marketing: { label: 'إعلانات ممولة', total: 0 },
        packaging: { label: 'تغليف ومطبوعات', total: 0 },
        delivery: { label: 'شحن وتوصيل', total: 0 },
        returns: { label: 'مرجوعات وتوالف', total: 0 },
        salaries: { label: 'رواتب وعمالة', total: 0 },
        other: { label: 'أخرى', total: 0 }
      };

      store.state.expenses.forEach(e => {
        const cat = e.category || 'other';
        if (catMap[cat]) {
          catMap[cat].total += (e.amountLYD || 0);
        } else {
          catMap.other.total += (e.amountLYD || 0);
        }
      });

      const labels = Object.values(catMap).map(c => c.label);
      const data = Object.values(catMap).map(c => c.total);

      this.expensesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: [
              '#10b981',
              '#06b6d4',
              '#f59e0b',
              '#ef4444',
              '#8b5cf6',
              '#64748b'
            ],
            borderColor: '#141e19',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#94a3b8', font: { family: 'Cairo', size: 11 }, boxWidth: 12 }
            }
          }
        }
      });
    }
  }

  /* ==========================================================================
     2. BUSINESSES MODULE
     ========================================================================== */
  renderActiveBusinesses() {
    const container = document.getElementById('activeBusinessesGrid');
    if (!container) return;

    const activeList = store.state.businesses.filter(b => b.status === 'active');
    if (activeList.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="bi bi-briefcase text-muted" style="font-size: 3rem;"></i>
          <h5 class="text-white mt-3">لا توجد مشاريع نشطة حالياً</h5>
          <p class="text-muted">ابدأ بإضافة مشروعك التجاري الأول لحساب التكاليف ومتابعة المبيعات فورياً.</p>
          <button class="btn btn-emerald mt-2" onclick="ui.navigateTo('add-business')">
            <i class="bi bi-plus-circle-fill"></i> إضافة مشروع جديد
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = activeList.map(biz => {
      const metrics = store.getBusinessMetrics(biz.id);
      const originBadge = biz.origin === 'china' ? 'الصين 🇨🇳 (استيراد)' : 'ليبيا 🇱🇾 (محلي)';

      return `
        <div class="col-xl-4 col-md-6">
          <div class="custom-card business-card">
            
            <div class="business-card-header">
              ${biz.imageUrl 
                ? `<img src="${biz.imageUrl}" alt="${biz.productName}" class="business-avatar">`
                : `<div class="business-avatar-placeholder"><i class="bi bi-box-seam"></i></div>`
              }
              <div class="business-title-info">
                <h5 class="business-title" title="${biz.name}">${biz.name}</h5>
                <div class="business-product text-truncate">${biz.productName}</div>
                <span class="business-tag"><i class="bi bi-geo-alt"></i> ${originBadge}</span>
              </div>
            </div>

            <!-- Financial Metrics Grid -->
            <div class="business-financial-grid">
              <div>
                <div class="financial-item-label">رأس المال المستثمر</div>
                <div class="financial-item-value">${this.formatMoney(biz.totalCapital)} د.ل</div>
              </div>
              <div>
                <div class="financial-item-label">متوسط تكلفة القطعة</div>
                <div class="financial-item-value text-info">${this.formatMoney(biz.unitCost)} د.ل</div>
              </div>
              <div>
                <div class="financial-item-label">إجمالي المبيعات</div>
                <div class="financial-item-value">${this.formatMoney(metrics.totalSalesRevenue)} د.ل</div>
              </div>
              <div>
                <div class="financial-item-label">صافي الربح المحقق</div>
                <div class="financial-item-value ${metrics.realizedNetProfit >= 0 ? 'profit' : 'loss'}">
                  ${this.formatMoney(metrics.realizedNetProfit)} د.ل
                  <small style="font-size:0.7rem;">(${metrics.profitMargin}%)</small>
                </div>
              </div>
            </div>

            <!-- Stock Progress -->
            <div class="stock-progress-wrap">
              <div class="stock-progress-labels">
                <span>المخزون المتبقي: <strong>${metrics.remainingQuantity}</strong> من ${biz.totalQuantity}</span>
                <span>قيمة المتبقي: <strong>${this.formatMoney(metrics.remainingStockValue)} د.ل</strong></span>
              </div>
              <div class="stock-progress-bar">
                <div class="stock-progress-fill" style="width: ${metrics.stockSoldPercent}%;"></div>
              </div>
            </div>

            <!-- Card Actions -->
            <div class="mt-auto pt-2 d-flex gap-2">
              <button class="btn btn-emerald btn-sm flex-grow-1" onclick="ui.openBusinessDetails('${biz.id}')">
                <i class="bi bi-eye-fill"></i> التفاصيل والحركات
              </button>
              <button class="btn btn-outline-emerald btn-sm" onclick="ui.openQuickSaleForBiz('${biz.id}')" title="تسجيل بيع">
                <i class="bi bi-cart-plus-fill"></i>
              </button>
              <button class="btn btn-dark-subtle btn-sm" onclick="app.editBusiness('${biz.id}')" title="تعديل">
                <i class="bi bi-pencil-fill"></i>
              </button>
            </div>

          </div>
        </div>
      `;
    }).join('');
  }

  renderClosedBusinesses() {
    const container = document.getElementById('closedBusinessesGrid');
    if (!container) return;

    const closedList = store.state.businesses.filter(b => b.status === 'closed');
    if (closedList.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="bi bi-archive text-muted" style="font-size: 3rem;"></i>
          <h5 class="text-white mt-3">الأرشيف فارغ حالياً</h5>
          <p class="text-muted">المشاريع التي تقوم بإغلاقها ستظهر هنا بكافة سجلاتها التاريخية.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = closedList.map(biz => {
      const metrics = store.getBusinessMetrics(biz.id);
      return `
        <div class="col-xl-4 col-md-6">
          <div class="custom-card border-secondary opacity-75">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="fw-bold text-white mb-0">${biz.name}</h5>
              <span class="badge bg-secondary">مغلق / مؤرشف</span>
            </div>
            <div class="text-muted small mb-3">${biz.productName}</div>
            
            <div class="row g-2 mb-3 small">
              <div class="col-6">رأس المال: <strong>${this.formatMoney(biz.totalCapital)} د.ل</strong></div>
              <div class="col-6">المبيعات: <strong>${this.formatMoney(metrics.totalSalesRevenue)} د.ل</strong></div>
              <div class="col-6">صافي الربح: <strong class="${metrics.realizedNetProfit >= 0 ? 'text-success' : 'text-danger'}">${this.formatMoney(metrics.realizedNetProfit)} د.ل</strong></div>
              <div class="col-6">المباع: <strong>${metrics.soldQuantity} / ${biz.totalQuantity}</strong></div>
            </div>

            <div class="d-flex gap-2">
              <button class="btn btn-outline-emerald btn-sm flex-grow-1" onclick="ui.openBusinessDetails('${biz.id}')">
                عرض السجل الكامل
              </button>
              <button class="btn btn-dark-subtle btn-sm" onclick="app.restoreBusiness('${biz.id}')" title="إعادة تنشيط">
                <i class="bi bi-arrow-clockwise"></i> إعادة تنشيط
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  openBusinessDetails(bizId) {
    const biz = store.getBusinessById(bizId);
    if (!biz) return;

    const metrics = store.getBusinessMetrics(bizId);

    document.getElementById('modalBizTitle').innerHTML = `
      <i class="bi bi-briefcase text-success me-1"></i> ${biz.name} - <small class="text-muted">${biz.productName}</small>
    `;

    // Overview Stats
    document.getElementById('modalBizStatsCards').innerHTML = `
      <div class="col-xl-3 col-md-4 col-6">
        <div class="p-2 rounded bg-dark border border-secondary text-center h-100 d-flex flex-column justify-content-center">
          <div class="text-white-50 small mb-1">رأس المال المستثمر</div>
          <div class="fw-bold fs-6 text-white">${this.formatMoney(biz.totalCapital)} د.ل</div>
        </div>
      </div>
      <div class="col-xl-3 col-md-4 col-6">
        <div class="p-2 rounded bg-dark border border-secondary text-center h-100 d-flex flex-column justify-content-center">
          <div class="text-white-50 small mb-1">متوسط تكلفة القطعة</div>
          <div class="fw-bold fs-6 text-info">${this.formatMoney(biz.unitCost)} د.ل</div>
        </div>
      </div>
      <div class="col-xl-3 col-md-4 col-6">
        <div class="p-2 rounded bg-dark border border-secondary text-center h-100 d-flex flex-column justify-content-center">
          <div class="text-white-50 small mb-1">إجمالي المبيعات</div>
          <div class="fw-bold fs-6 text-white">${this.formatMoney(metrics.totalSalesRevenue)} د.ل</div>
        </div>
      </div>
      <div class="col-xl-3 col-md-4 col-6">
        <div class="p-2 rounded bg-dark border border-secondary text-center h-100 d-flex flex-column justify-content-center">
          <div class="text-white-50 small mb-1">صافي الربح المحقق</div>
          <div class="fw-bold fs-6 ${metrics.realizedNetProfit >= 0 ? 'text-success' : 'text-danger'}">
            ${this.formatMoney(metrics.realizedNetProfit)} د.ل
          </div>
        </div>
      </div>
      <div class="col-xl-4 col-md-4 col-6">
        <div class="p-2 rounded bg-dark border border-secondary text-center h-100 d-flex flex-column justify-content-center">
          <div class="text-white-50 small mb-1">متوسط الربح في القطعة</div>
          <div class="fw-bold fs-6 ${metrics.avgProfitPerUnit >= 0 ? 'text-success' : 'text-danger'}">
            ${this.formatMoney(metrics.avgProfitPerUnit)} د.ل
          </div>
        </div>
      </div>
      <div class="col-xl-4 col-md-4 col-6">
        <div class="p-2 rounded bg-dark border border-secondary text-center h-100 d-flex flex-column justify-content-center">
          <div class="text-white-50 small mb-1">عائد الاستثمار (من رأس المال)</div>
          <div class="fw-bold fs-6 ${metrics.roi >= 0 ? 'text-success' : 'text-danger'}">
            ${metrics.roi}%
          </div>
        </div>
      </div>
      <div class="col-xl-4 col-md-4 col-6">
        <div class="p-2 rounded bg-dark border border-secondary text-center h-100 d-flex flex-column justify-content-center">
          <div class="text-white-50 small mb-1">هامش الربح (من المبيعات)</div>
          <div class="fw-bold fs-6 ${metrics.profitMargin >= 0 ? 'text-success' : 'text-danger'}">
            ${metrics.profitMargin}%
          </div>
        </div>
      </div>
    `;

    // Stock Ratio
    const modalStockText = document.getElementById('modalStockRatioText');
    if (modalStockText) {
      modalStockText.innerHTML = `
        <span class="text-white fw-bold">${metrics.soldQuantity}</span> من أصل <span class="text-white fw-bold">${biz.totalQuantity}</span> مباع (<span class="text-success fw-bold">${metrics.stockSoldPercent}%</span>) 
        <span class="text-white-50 mx-1">|</span> 
        المتبقي بالمستودع: <span class="text-white fw-bold">${metrics.remainingQuantity} قطعة</span> 
        <span class="text-info font-monospace">(بقيمة ${this.formatMoney(metrics.remainingStockValue)} د.ل)</span>
      `;
    }
    document.getElementById('modalStockProgressFill').style.width = `${metrics.stockSoldPercent}%`;

    // Business Sales Table (مرتبة من الإدخال الأول إلى الأخير مع الترقيم المتسلسل)
    const bizSales = store.state.sales
      .filter(s => s.businessId === bizId)
      .slice()
      .sort((a, b) => new Date(a.createdAt || a.saleDate) - new Date(b.createdAt || b.saleDate));

    const salesTbody = document.getElementById('modalBizSalesTableBody');
    if (bizSales.length === 0) {
      salesTbody.innerHTML = `<tr><td colspan="10" class="text-center py-3 text-muted">لا توجد مبيعات لهذا المشروع بعد</td></tr>`;
    } else {
      salesTbody.innerHTML = bizSales.map((s, index) => `
        <tr>
          <td><span class="badge bg-secondary font-monospace">${index + 1}</span></td>
          <td><span class="font-monospace text-success fw-bold">${s.invoiceNo}</span></td>
          <td>${s.saleDate}</td>
          <td>${s.customerName}</td>
          <td><span class="badge bg-dark">${s.quantity} قطعة</span></td>
          <td>${this.formatMoney(s.unitPrice)} د.ل</td>
          <td class="fw-bold text-white">${this.formatMoney(s.totalAmount)} د.ل</td>
          <td class="fw-bold ${s.netProfit >= 0 ? 'text-success' : 'text-danger'}">${this.formatMoney(s.netProfit)} د.ل</td>
          <td>${s.paymentStatus === 'paid' ? '<span class="badge badge-paid-full">مدفوع</span>' : (s.paymentStatus === 'partial' ? '<span class="badge badge-paid-partial">جزئي</span>' : '<span class="badge badge-paid-debt">بالأجل</span>')}</td>
          <td class="text-center">
            <div class="d-inline-flex gap-1">
              <button class="btn btn-sm btn-outline-info" onclick="app.editSale('${s.id}')" title="تعديل عملية البيع">
                <i class="bi bi-pencil-fill"></i>
              </button>
              <button class="btn btn-sm btn-dark-subtle" onclick="ui.showReceipt('${s.id}')" title="طباعة إيصال">
                <i class="bi bi-receipt"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="app.deleteSale('${s.id}')" title="حذف عملية البيع">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    // Business Expenses Table
    const expenses = store.state.expenses.filter(e => e.businessId === bizId);
    const expensesTbody = document.getElementById('modalBizExpensesTableBody');
    if (expenses.length === 0) {
      expensesTbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">لا توجد مصروفات مخصصة لهذا المشروع</td></tr>`;
    } else {
      expensesTbody.innerHTML = expenses.map(e => `
        <tr>
          <td>${e.date}</td>
          <td>${e.title}</td>
          <td><span class="badge bg-dark">${this.getCategoryLabel(e.category)}</span></td>
          <td class="fw-bold text-warning">${this.formatMoney(e.amountLYD)} د.ل</td>
        </tr>
      `).join('');
    }

    // Bind action buttons
    document.getElementById('modalDirectSaleBtn').onclick = () => {
      this.businessDetailModal.hide();
      this.openQuickSaleForBiz(bizId);
    };

    document.getElementById('modalEditBizBtn').onclick = () => {
      this.businessDetailModal.hide();
      app.editBusiness(bizId);
    };

    document.getElementById('modalArchiveBizBtn').onclick = () => {
      if (confirm(`هل أنت متأكد من رغبتك في إغلاق وأرشفة المشروع "${biz.name}"؟`)) {
        store.archiveBusiness(bizId);
        this.businessDetailModal.hide();
        this.showToast('تم أرشفة المشروع بنجاح', 'success');
      }
    };

    document.getElementById('modalDeleteBizBtn').onclick = () => {
      if (confirm(`تحذير: سيؤدي حذف المشروع "${biz.name}" إلى مسح كافة مبيعاته ومصروفاته المرتبطة. هل ترغب بالاستمرار؟`)) {
        store.deleteBusiness(bizId);
        this.businessDetailModal.hide();
        this.showToast('تم حذف المشروع بالكامل', 'warning');
      }
    };

    this.businessDetailModal.show();
  }

  openQuickSaleForBiz(bizId) {
    const bizSelect = document.getElementById('saleBusinessSelect');
    if (bizSelect) {
      bizSelect.value = bizId;
      bizSelect.dispatchEvent(new Event('change'));
    }
    this.saleModal.show();
  }

  /* ==========================================================================
     3. SALES MODULE
     ========================================================================== */
  renderSalesTable() {
    const tbody = document.getElementById('salesTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('salesSearchInput')?.value || '').toLowerCase().trim();
    const filterBiz = document.getElementById('salesFilterBusiness')?.value || 'all';
    const filterStatus = document.getElementById('salesFilterStatus')?.value || 'all';

    let list = store.state.sales;

    if (filterBiz !== 'all') {
      list = list.filter(s => s.businessId === filterBiz);
    }

    if (filterStatus !== 'all') {
      list = list.filter(s => s.paymentStatus === filterStatus);
    }

    if (searchTerm) {
      list = list.filter(s => 
        (s.customerName && s.customerName.toLowerCase().includes(searchTerm)) ||
        (s.customerPhone && s.customerPhone.includes(searchTerm)) ||
        (s.invoiceNo && s.invoiceNo.toLowerCase().includes(searchTerm)) ||
        (s.productName && s.productName.toLowerCase().includes(searchTerm))
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-muted">لا توجد عمليات بيع مطابقة للفلاتر الحالية</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(sale => {
      let statusBadge = '';
      if (sale.paymentStatus === 'paid') {
        statusBadge = '<span class="badge badge-paid-full"><i class="bi bi-check-circle"></i> مدفوع</span>';
      } else if (sale.paymentStatus === 'partial') {
        statusBadge = '<span class="badge badge-paid-partial"><i class="bi bi-hourglass-split"></i> جزئي</span>';
      } else {
        statusBadge = '<span class="badge badge-paid-debt"><i class="bi bi-exclamation-circle"></i> بالأجل</span>';
      }

      return `
        <tr>
          <td><span class="font-monospace text-success fw-bold">${sale.invoiceNo}</span></td>
          <td>${sale.saleDate}</td>
          <td>
            <div class="fw-bold text-white">${sale.businessName}</div>
            <small class="text-muted">${sale.productName}</small>
          </td>
          <td>
            <div>${sale.customerName}</div>
            ${sale.customerPhone ? `<small class="text-muted"><i class="bi bi-telephone"></i> ${sale.customerPhone}</small>` : ''}
          </td>
          <td><span class="badge bg-dark">${sale.quantity} قطعة</span></td>
          <td>${this.formatMoney(sale.unitPrice)} د.ل</td>
          <td class="fw-bold text-white">${this.formatMoney(sale.totalAmount)} د.ل</td>
          <td class="text-info">${this.formatMoney(sale.cogs)} د.ل</td>
          <td class="fw-bold ${sale.netProfit >= 0 ? 'text-success' : 'text-danger'}">
            ${this.formatMoney(sale.netProfit)} د.ل
          </td>
          <td>${statusBadge}</td>
          <td class="${sale.remainingAmount > 0 ? 'text-danger fw-bold' : 'text-muted'}">
            ${this.formatMoney(sale.remainingAmount)} د.ل
          </td>
          <td class="text-center">
            <div class="d-inline-flex gap-1">
              ${sale.remainingAmount > 0 ? `
                <button class="btn btn-sm btn-outline-warning" onclick="app.openDebtPayment('${sale.id}')" title="تحصيل دفعة">
                  <i class="bi bi-cash"></i>
                </button>
              ` : ''}
              <button class="btn btn-sm btn-outline-info" onclick="app.editSale('${sale.id}')" title="تعديل">
                <i class="bi bi-pencil-fill"></i>
              </button>
              <button class="btn btn-sm btn-dark-subtle" onclick="ui.showReceipt('${sale.id}')" title="طباعة إيصال">
                <i class="bi bi-receipt"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="app.deleteSale('${sale.id}')" title="حذف">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  showReceipt(saleId) {
    const sale = store.state.sales.find(s => s.id === saleId);
    if (!sale) return;

    const printArea = document.getElementById('receiptPrintArea');
    printArea.innerHTML = `
      <div class="text-center pb-3 border-bottom border-secondary mb-3">
        <h4 class="fw-bold text-white mb-1">إيصال وفاتورة بيع</h4>
        <div class="text-success fw-bold">${sale.businessName}</div>
        <div class="text-muted small">رقم الفاتورة: <strong class="text-white">${sale.invoiceNo}</strong> | التاريخ: ${sale.saleDate}</div>
      </div>

      <div class="mb-3 small">
        <div><strong>الزبون:</strong> ${sale.customerName}</div>
        ${sale.customerPhone ? `<div><strong>الهاتف:</strong> ${sale.customerPhone}</div>` : ''}
      </div>

      <table class="table table-dark table-sm border border-secondary mb-3">
        <thead>
          <tr>
            <th>المنتج</th>
            <th>الكمية</th>
            <th>السعر</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${sale.productName}</td>
            <td>${sale.quantity}</td>
            <td>${this.formatMoney(sale.unitPrice)} د.ل</td>
            <td>${this.formatMoney(sale.subtotal)} د.ل</td>
          </tr>
        </tbody>
      </table>

      <div class="p-2 rounded bg-dark border border-secondary small">
        <div class="d-flex justify-content-between"><span>الخصم الممنوح:</span><span>${this.formatMoney(sale.discount)} د.ل</span></div>
        <div class="d-flex justify-content-between fw-bold text-white fs-6 mt-1 border-top border-secondary pt-1">
          <span>المبلغ الإجمالي:</span><span>${this.formatMoney(sale.totalAmount)} د.ل</span>
        </div>
        <div class="d-flex justify-content-between text-success mt-1"><span>المبلغ المدفوع:</span><span>${this.formatMoney(sale.paidAmount)} د.ل</span></div>
        <div class="d-flex justify-content-between text-danger mt-1"><span>المتبقي:</span><span>${this.formatMoney(sale.remainingAmount)} د.ل</span></div>
      </div>

      ${sale.notes ? `<div class="mt-3 text-muted small"><strong>ملاحظات:</strong> ${sale.notes}</div>` : ''}

      <div class="text-center text-muted small mt-4 pt-2 border-top border-secondary">
        شكراً لتعاملكم معنا!
      </div>
    `;

    this.receiptModal.show();
  }

  /* ==========================================================================
     4. EXPENSES MODULE
     ========================================================================== */
  renderExpensesTable() {
    const tbody = document.getElementById('expensesTableBody');
    if (!tbody) return;

    const filterBiz = document.getElementById('expenseFilterBusiness')?.value || 'all';
    const filterCat = document.getElementById('expenseFilterCategory')?.value || 'all';

    let list = store.state.expenses;

    if (filterBiz !== 'all') {
      list = list.filter(e => e.businessId === filterBiz);
    }
    if (filterCat !== 'all') {
      list = list.filter(e => e.category === filterCat);
    }

    const total = list.reduce((sum, e) => sum + (parseFloat(e.amountLYD) || 0), 0);
    const totalEl = document.getElementById('totalFilteredExpenses');
    if (totalEl) totalEl.textContent = `${this.formatMoney(total)} د.ل`;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">لا توجد مصروفات مسجلة</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(exp => `
      <tr>
        <td>${exp.date}</td>
        <td class="fw-bold text-white">${exp.title}</td>
        <td><span class="badge bg-dark">${this.getCategoryLabel(exp.category)}</span></td>
        <td><span class="text-muted">${exp.businessName}</span></td>
        <td>${exp.currency === 'USD' ? `${this.formatMoney(exp.amount)} $` : `${this.formatMoney(exp.amount)} د.ل`}</td>
        <td class="fw-bold text-warning">${this.formatMoney(exp.amountLYD)} د.ل</td>
        <td class="small text-muted">${exp.notes || '-'}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-danger" onclick="app.deleteExpense('${exp.id}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  getCategoryLabel(cat) {
    const map = {
      marketing: 'إعلانات وتسويق',
      packaging: 'تغليف وكراتين',
      delivery: 'شحن وتوصيل',
      returns: 'مرجوعات وتوالف',
      salaries: 'رواتب وعمالة',
      other: 'أخرى'
    };
    return map[cat] || cat;
  }

  /* ==========================================================================
     5. REPORTS MODULE
     ========================================================================== */
  renderReports() {
    // 1. Business Analytical Table
    const bizTbody = document.getElementById('reportsBusinessTableBody');
    if (bizTbody) {
      const allBiz = store.state.businesses;
      if (allBiz.length === 0) {
        bizTbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">لا توجد بيانات متاحة لإعداد التقارير</td></tr>`;
      } else {
        bizTbody.innerHTML = allBiz.map(biz => {
          const m = store.getBusinessMetrics(biz.id);
          return `
            <tr>
              <td>
                <strong class="text-white">${biz.name}</strong>
                <div class="small text-muted">${biz.productName}</div>
              </td>
              <td>${this.formatMoney(biz.totalCapital)} د.ل</td>
              <td><span class="badge bg-dark">${m.soldQuantity} / ${biz.totalQuantity} (${m.stockSoldPercent}%)</span></td>
              <td class="fw-bold">${this.formatMoney(m.totalSalesRevenue)} د.ل</td>
              <td class="text-info">${this.formatMoney(m.totalCOGS)} د.ل</td>
              <td class="text-warning">${this.formatMoney(m.totalOperatingExpenses + m.totalDirectSellingExpenses)} د.ل</td>
              <td class="fw-bold ${m.realizedNetProfit >= 0 ? 'text-success' : 'text-danger'}">
                ${this.formatMoney(m.realizedNetProfit)} د.ل
              </td>
              <td><span class="badge ${m.profitMargin >= 0 ? 'bg-success' : 'bg-danger'} text-white">${m.profitMargin}%</span></td>
              <td><span class="badge bg-dark">${m.roi}%</span></td>
              <td>${this.formatMoney(m.remainingStockValue)} د.ل</td>
            </tr>
          `;
        }).join('');
      }
    }

    // 2. Debts & Receivables Table
    const debtsTbody = document.getElementById('reportsDebtsTableBody');
    const debtsList = store.state.sales.filter(s => (s.remainingAmount || 0) > 0);
    const totalDebt = debtsList.reduce((acc, s) => acc + (s.remainingAmount || 0), 0);

    const debtBadge = document.getElementById('reportsTotalDebtBadge');
    if (debtBadge) debtBadge.textContent = `${this.formatMoney(totalDebt)} د.ل`;

    if (debtsTbody) {
      if (debtsList.length === 0) {
        debtsTbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-success"><i class="bi bi-check-circle"></i> رائع! لا توجد أي ديون مستحقة على الزبائن حالياً</td></tr>`;
      } else {
        debtsTbody.innerHTML = debtsList.map(s => `
          <tr>
            <td><span class="font-monospace text-success">${s.invoiceNo}</span></td>
            <td>${s.saleDate}</td>
            <td class="fw-bold text-white">${s.customerName}</td>
            <td>${s.customerPhone || '-'}</td>
            <td>${s.businessName}</td>
            <td>${this.formatMoney(s.totalAmount)} د.ل</td>
            <td class="text-success">${this.formatMoney(s.paidAmount)} د.ل</td>
            <td class="fw-bold text-danger">${this.formatMoney(s.remainingAmount)} د.ل</td>
            <td>
              <button class="btn btn-sm btn-outline-warning" onclick="app.openDebtPayment('${s.id}')">
                تحصيل دفعة
              </button>
            </td>
          </tr>
        `).join('');
      }
    }
  }

  /* ==========================================================================
     DROPDOWNS & SELECT POPULATION
     ========================================================================== */
  populateDropdowns() {
    const activeBiz = store.state.businesses.filter(b => b.status === 'active');
    const allBiz = store.state.businesses;

    // Sales Business Select
    const saleBizSelect = document.getElementById('saleBusinessSelect');
    if (saleBizSelect) {
      const currentVal = saleBizSelect.value;
      saleBizSelect.innerHTML = activeBiz.map(b => `<option value="${b.id}">${b.name} (${b.productName})</option>`).join('');
      if (currentVal && activeBiz.some(b => b.id === currentVal)) {
        saleBizSelect.value = currentVal;
      }
    }

    // Sales Filter Select
    const salesFilterBiz = document.getElementById('salesFilterBusiness');
    if (salesFilterBiz) {
      salesFilterBiz.innerHTML = '<option value="all">كل المشاريع والبزنسات</option>' +
        allBiz.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    }

    // Expenses Filter & Form Select
    const expBizSelect = document.getElementById('expBusiness');
    if (expBizSelect) {
      expBizSelect.innerHTML = '<option value="all">مصروف عام (مشترك)</option>' +
        allBiz.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    }

    const expFilterBiz = document.getElementById('expenseFilterBusiness');
    if (expFilterBiz) {
      expFilterBiz.innerHTML = '<option value="all">كل المشاريع والمصروفات العامة</option>' +
        allBiz.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    }
  }

  /* ==========================================================================
     FIREBASE AUTH UI & SETTINGS
     ========================================================================== */
  updateAuthUI(user) {
    const loggedOut = document.getElementById('authLoggedOutView');
    const loggedIn = document.getElementById('authLoggedInView');
    const userInfo = document.getElementById('authUserInfo');

    const topbarLoginBtn = document.getElementById('topbarLoginBtn');
    const topbarUserDropdown = document.getElementById('topbarUserDropdown');
    const topbarUserName = document.getElementById('topbarUserName');
    const dropdownUserDisplayName = document.getElementById('dropdownUserDisplayName');
    const dropdownUserEmail = document.getElementById('dropdownUserEmail');

    if (user) {
      this.hideAuthScreen();
      this.updateGuestBanner(false);

      if (loggedOut) loggedOut.classList.add('d-none');
      if (loggedIn) loggedIn.classList.remove('d-none');
      if (userInfo) userInfo.textContent = `${user.displayName || user.email} (${user.uid.substring(0, 8)}...)`;

      if (topbarLoginBtn) topbarLoginBtn.classList.add('d-none');
      if (topbarUserDropdown) topbarUserDropdown.classList.remove('d-none');
      
      const displayName = user.displayName || user.email.split('@')[0];
      if (topbarUserName) topbarUserName.textContent = displayName;
      if (dropdownUserDisplayName) dropdownUserDisplayName.textContent = user.displayName || displayName;
      if (dropdownUserEmail) dropdownUserEmail.textContent = user.email || '';
    } else {
      const isGuest = sessionStorage.getItem('guestMode') === 'true';
      if (isGuest) {
        this.hideAuthScreen();
        this.updateGuestBanner(true);
      } else {
        this.showAuthScreen();
        this.updateGuestBanner(false);
      }

      if (loggedOut) loggedOut.classList.remove('d-none');
      if (loggedIn) loggedIn.classList.add('d-none');

      if (topbarLoginBtn) topbarLoginBtn.classList.remove('d-none');
      if (topbarUserDropdown) topbarUserDropdown.classList.add('d-none');
    }
  }

  populateFirebaseSettingsInputs() {
    const config = window.getActiveFirebaseConfig ? window.getActiveFirebaseConfig() : (store.state.settings ? store.state.settings.firebaseConfig : null);
    if (config) {
      const apiKeyEl = document.getElementById('fbApiKey');
      const authDomainEl = document.getElementById('fbAuthDomain');
      const dbUrlEl = document.getElementById('fbDatabaseURL');
      const projectIdEl = document.getElementById('fbProjectId');

      if (apiKeyEl) apiKeyEl.value = config.apiKey || '';
      if (authDomainEl) authDomainEl.value = config.authDomain || '';
      if (dbUrlEl) dbUrlEl.value = config.databaseURL || '';
      if (projectIdEl) projectIdEl.value = config.projectId || '';
    }
  }

  /* ==========================================================================
     TOAST NOTIFICATIONS
     ========================================================================== */
  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-custom ${type}`;

    let icon = 'bi-check-circle-fill text-success';
    if (type === 'error') icon = 'bi-exclamation-triangle-fill text-danger';
    if (type === 'warning') icon = 'bi-exclamation-circle-fill text-warning';

    toast.innerHTML = `
      <i class="bi ${icon} fs-5"></i>
      <span class="flex-grow-1">${message}</span>
      <button type="button" class="btn-close btn-close-white btn-sm ms-2" onclick="this.parentElement.remove()"></button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Global UI Instance
const ui = new UIManager();
