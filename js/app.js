/**
 * app.js - Main Application Controller & Event Listeners
 * Manages Dynamic Calculations, Forms, Interactions, and Cloud Sync triggers.
 */

class AppController {
  constructor() {
    this.extraCostsCount = 0;
  }

  init() {
    this.setupStoreListeners();
    this.setupBusinessFormEvents();
    this.setupSalesEvents();
    this.setupExpensesEvents();
    this.setupSettingsAndCloudEvents();
    this.setupQuickButtons();
    
    // Initial UI render
    ui.init();
    this.initFirebase();
  }

  setupStoreListeners() {
    store.subscribe(() => {
      ui.renderAll();
      // Auto sync to cloud if configured and logged in
      if (firebaseService.isInitialized && firebaseService.currentUser) {
        firebaseService.syncLocalToCloud();
      }
    });
  }

  async initFirebase() {
    const config = (store.state.settings && store.state.settings.firebaseConfig && store.state.settings.firebaseConfig.apiKey) 
      ? store.state.settings.firebaseConfig 
      : (window.getActiveFirebaseConfig ? window.getActiveFirebaseConfig() : null);
    if (config && config.apiKey) {
      await firebaseService.init(config);
    }
  }

  /* ==========================================================================
     1. BUSINESS FORM & LIVE SUMMARY CALCULATIONS
     ========================================================================== */
  setupBusinessFormEvents() {
    const form = document.getElementById('businessForm');
    if (!form) return;

    // Currency Switcher
    const currLYD = document.getElementById('currModeLYD');
    const currUSD = document.getElementById('currModeUSD');
    const lydGroup = document.getElementById('lydPurchaseGroup');
    const usdPriceGroup = document.getElementById('usdPriceGroup');
    const usdRateGroup = document.getElementById('usdRateGroup');

    const updateCurrencyUI = () => {
      if (currUSD.checked) {
        lydGroup.classList.add('d-none');
        usdPriceGroup.classList.remove('d-none');
        usdRateGroup.classList.remove('d-none');
      } else {
        lydGroup.classList.remove('d-none');
        usdPriceGroup.classList.add('d-none');
        usdRateGroup.classList.add('d-none');
      }
      this.recalculateBusinessLiveSummary();
    };

    currLYD.addEventListener('change', updateCurrencyUI);
    currUSD.addEventListener('change', updateCurrencyUI);

    // Shipping Type & Currency Switchers
    const shipSea = document.getElementById('shipSea');
    const shipAir = document.getElementById('shipAir');
    const seaCbmGroup = document.getElementById('seaCbmGroup');
    const seaRateGroup = document.getElementById('seaRateGroup');
    const airWeightGroup = document.getElementById('airWeightGroup');
    const airRateGroup = document.getElementById('airRateGroup');

    const updateShippingTypeUI = () => {
      if (shipSea.checked) {
        seaCbmGroup.classList.remove('d-none');
        seaRateGroup.classList.remove('d-none');
        airWeightGroup.classList.add('d-none');
        airRateGroup.classList.add('d-none');
      } else {
        seaCbmGroup.classList.add('d-none');
        seaRateGroup.classList.add('d-none');
        airWeightGroup.classList.remove('d-none');
        airRateGroup.classList.remove('d-none');
      }
      this.recalculateBusinessLiveSummary();
    };

    shipSea.addEventListener('change', updateShippingTypeUI);
    shipAir.addEventListener('change', updateShippingTypeUI);

    const shipCurrLYD = document.getElementById('shipCurrLYD');
    const shipCurrUSD = document.getElementById('shipCurrUSD');
    const shipExRateGroup = document.getElementById('shippingExchangeRateGroup');

    const updateShippingCurrUI = () => {
      if (shipCurrUSD.checked) {
        shipExRateGroup.classList.remove('d-none');
      } else {
        shipExRateGroup.classList.add('d-none');
      }
      this.recalculateBusinessLiveSummary();
    };

    shipCurrLYD.addEventListener('change', updateShippingCurrUI);
    shipCurrUSD.addEventListener('change', updateShippingCurrUI);

    // Dynamic Extra Costs Button
    const addCostBtn = document.getElementById('addExtraCostBtn');
    addCostBtn.addEventListener('click', () => {
      this.addExtraCostRow();
    });

    // Marketing Toggle
    const marketingCheck = document.getElementById('bizEnableMarketing');
    const marketingInputGroup = document.getElementById('marketingCostInputGroup');
    marketingCheck.addEventListener('change', () => {
      if (marketingCheck.checked) {
        marketingInputGroup.classList.remove('d-none');
      } else {
        marketingInputGroup.classList.add('d-none');
      }
      this.recalculateBusinessLiveSummary();
    });

    // Live calculation listeners for all numerical inputs
    const inputIds = [
      'bizTotalQuantity', 'bizPurchasePriceLYD', 'bizPurchasePriceUSD', 'bizExchangeRate',
      'bizSeaCbm', 'bizSeaRatePerCbm', 'bizAirWeightKg', 'bizAirRatePerKg',
      'bizShippingExchangeRate', 'bizCustomShippingCostManual', 'bizMarketingCostLYD'
    ];

    inputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.recalculateBusinessLiveSummary());
      }
    });

    // Save Business Button
    const saveBtn = document.getElementById('saveBusinessBtn');
    saveBtn.addEventListener('click', () => this.handleSaveBusiness());

    // Image Upload Handler (convert to Base64)
    const fileInput = document.getElementById('bizImageFile');
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          document.getElementById('bizImageUrl').value = evt.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  addExtraCostRow(name = '', amount = '') {
    this.extraCostsCount++;
    const container = document.getElementById('dynamicExtraCostsList');
    const row = document.createElement('div');
    row.className = 'dynamic-cost-item';
    row.id = `extraCostRow_${this.extraCostsCount}`;

    row.innerHTML = `
      <input type="text" class="form-control form-control-sm cost-name" placeholder="اسم التكلفة (عمالة، تغليف...)" value="${name}">
      <div class="input-group input-group-sm" style="max-width: 170px;">
        <input type="number" step="0.01" class="form-control cost-amount" placeholder="0.00" value="${amount}">
        <span class="input-group-text">د.ل</span>
      </div>
      <button type="button" class="btn btn-sm btn-outline-danger" title="حذف">
        <i class="bi bi-trash"></i>
      </button>
    `;

    row.querySelector('.btn-outline-danger').addEventListener('click', () => {
      row.remove();
      this.recalculateBusinessLiveSummary();
    });

    row.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => this.recalculateBusinessLiveSummary());
    });

    container.appendChild(row);
    this.recalculateBusinessLiveSummary();
  }

  collectBusinessFormData() {
    const isUSD = document.getElementById('currModeUSD').checked;
    const isAir = document.getElementById('shipAir').checked;
    const isShipUSD = document.getElementById('shipCurrUSD').checked;

    // Collect dynamic extra costs
    const extraCosts = [];
    document.querySelectorAll('#dynamicExtraCostsList .dynamic-cost-item').forEach(row => {
      const name = row.querySelector('.cost-name').value.trim();
      const amount = parseFloat(row.querySelector('.cost-amount').value) || 0;
      if (name || amount > 0) {
        extraCosts.push({ name: name || 'تكلفة إضافية', amount });
      }
    });

    return {
      name: document.getElementById('bizName').value,
      productName: document.getElementById('bizProductName').value,
      origin: document.getElementById('bizOrigin').value,
      purchaseDate: document.getElementById('bizPurchaseDate').value,
      totalQuantity: parseInt(document.getElementById('bizTotalQuantity').value, 10) || 1,
      description: document.getElementById('bizDescription').value,
      imageUrl: document.getElementById('bizImageUrl').value,
      currencyMode: isUSD ? 'usd_lyd' : 'lyd',
      purchasePriceLYD: parseFloat(document.getElementById('bizPurchasePriceLYD').value) || 0,
      purchasePriceUSD: parseFloat(document.getElementById('bizPurchasePriceUSD').value) || 0,
      exchangeRate: parseFloat(document.getElementById('bizExchangeRate').value) || 1,
      shippingType: isAir ? 'air' : 'sea',
      shippingCurrencyMode: isShipUSD ? 'usd_lyd' : 'lyd',
      shippingExchangeRate: parseFloat(document.getElementById('bizShippingExchangeRate').value) || 1,
      seaCbm: parseFloat(document.getElementById('bizSeaCbm').value) || 0,
      seaRatePerCbm: parseFloat(document.getElementById('bizSeaRatePerCbm').value) || 0,
      airWeightKg: parseFloat(document.getElementById('bizAirWeightKg').value) || 0,
      airRatePerKg: parseFloat(document.getElementById('bizAirRatePerKg').value) || 0,
      customShippingCostManual: document.getElementById('bizCustomShippingCostManual').value,
      extraCosts,
      enableMarketing: document.getElementById('bizEnableMarketing').checked,
      marketingCostLYD: parseFloat(document.getElementById('bizMarketingCostLYD').value) || 0
    };
  }

  recalculateBusinessLiveSummary() {
    const data = this.collectBusinessFormData();
    const calc = store.calculateBusinessCapital(data);

    // Update USD preview
    if (data.currencyMode === 'usd_lyd') {
      const equiv = data.purchasePriceUSD * data.exchangeRate;
      document.getElementById('equivalentLYDPreview').textContent = `المعادل: ${ui.formatMoney(equiv)} د.ل`;
    }

    // Update Live Summary Box
    document.getElementById('summaryPurchaseCost').textContent = `${ui.formatMoney(calc.purchaseCostLYD)} د.ل`;
    document.getElementById('summaryShippingCost').textContent = `${ui.formatMoney(calc.shippingCostLYD)} د.ل`;
    document.getElementById('summaryExtraCosts').textContent = `${ui.formatMoney(calc.extraCostsTotal)} د.ل`;
    document.getElementById('summaryMarketingCost').textContent = `${ui.formatMoney(calc.marketingCostLYD)} د.ل`;
    document.getElementById('summaryTotalCapital').textContent = `${ui.formatMoney(calc.totalCapital)} د.ل`;
    document.getElementById('summaryUnitCost').textContent = `${ui.formatMoney(calc.unitCost)} د.ل`;
  }

  handleSaveBusiness() {
    const data = this.collectBusinessFormData();

    if (!data.name || !data.productName) {
      ui.showToast('يرجى ملء اسم المشروع واسم المنتج.', 'error');
      return;
    }

    if (data.totalQuantity <= 0) {
      ui.showToast('يرجى تحديد عدد قطع أكبر من صفر.', 'error');
      return;
    }

    const editId = document.getElementById('editingBusinessId').value;

    if (editId) {
      store.updateBusiness(editId, data);
      ui.showToast(`تم تحديث المشروع "${data.name}" بنجاح!`, 'success');
    } else {
      store.addBusiness(data);
      ui.showToast(`تم إنشاء المشروع "${data.name}" وحساب تكلفة القطعة بنجاح!`, 'success');
    }

    this.resetBusinessForm();
    ui.navigateTo('businesses');
  }

  resetBusinessForm() {
    document.getElementById('businessForm').reset();
    document.getElementById('editingBusinessId').value = '';
    document.getElementById('businessFormTitle').textContent = 'إضافة مشروع تجاري جديد';
    document.getElementById('dynamicExtraCostsList').innerHTML = '';
    document.getElementById('marketingCostInputGroup').classList.add('d-none');
    document.getElementById('currModeLYD').checked = true;
    document.getElementById('currModeLYD').dispatchEvent(new Event('change'));
    document.getElementById('shipSea').checked = true;
    document.getElementById('shipSea').dispatchEvent(new Event('change'));
    document.getElementById('shipCurrLYD').checked = true;
    document.getElementById('shipCurrLYD').dispatchEvent(new Event('change'));
    this.recalculateBusinessLiveSummary();
  }

  editBusiness(bizId) {
    const biz = store.getBusinessById(bizId);
    if (!biz) return;

    this.resetBusinessForm();
    document.getElementById('editingBusinessId').value = biz.id;
    document.getElementById('businessFormTitle').textContent = `تعديل المشروع: ${biz.name}`;

    document.getElementById('bizName').value = biz.name;
    document.getElementById('bizProductName').value = biz.productName;
    document.getElementById('bizOrigin').value = biz.origin || 'china';
    document.getElementById('bizPurchaseDate').value = biz.purchaseDate || '';
    document.getElementById('bizTotalQuantity').value = biz.totalQuantity;
    document.getElementById('bizDescription').value = biz.description || '';
    document.getElementById('bizImageUrl').value = biz.imageUrl || '';

    // Currency
    if (biz.currencyMode === 'usd_lyd') {
      document.getElementById('currModeUSD').checked = true;
      document.getElementById('bizPurchasePriceUSD').value = biz.purchasePriceUSD || '';
      document.getElementById('bizExchangeRate').value = biz.exchangeRate || 7.25;
    } else {
      document.getElementById('currModeLYD').checked = true;
      document.getElementById('bizPurchasePriceLYD').value = biz.purchasePriceLYD || '';
    }
    document.getElementById('currModeLYD').dispatchEvent(new Event('change'));

    // Shipping
    if (biz.shippingType === 'air') {
      document.getElementById('shipAir').checked = true;
      document.getElementById('bizAirWeightKg').value = biz.airWeightKg || '';
      document.getElementById('bizAirRatePerKg').value = biz.airRatePerKg || '';
    } else {
      document.getElementById('shipSea').checked = true;
      document.getElementById('bizSeaCbm').value = biz.seaCbm || '';
      document.getElementById('bizSeaRatePerCbm').value = biz.seaRatePerCbm || '';
    }
    document.getElementById('shipSea').dispatchEvent(new Event('change'));

    if (biz.shippingCurrencyMode === 'usd_lyd') {
      document.getElementById('shipCurrUSD').checked = true;
      document.getElementById('bizShippingExchangeRate').value = biz.shippingExchangeRate || 7.25;
    } else {
      document.getElementById('shipCurrLYD').checked = true;
    }
    document.getElementById('shipCurrLYD').dispatchEvent(new Event('change'));

    document.getElementById('bizCustomShippingCostManual').value = biz.customShippingCostManual || '';

    // Extra costs
    if (Array.isArray(biz.extraCosts)) {
      biz.extraCosts.forEach(item => {
        this.addExtraCostRow(item.name, item.amount);
      });
    }

    // Marketing
    if (biz.enableMarketing) {
      document.getElementById('bizEnableMarketing').checked = true;
      document.getElementById('marketingCostInputGroup').classList.remove('d-none');
      document.getElementById('bizMarketingCostLYD').value = biz.marketingCostLYD || '';
    }

    this.recalculateBusinessLiveSummary();
    ui.navigateTo('add-business');
  }

  restoreBusiness(bizId) {
    store.restoreBusiness(bizId);
    ui.showToast('تمت إعادة تنشيط المشروع ونقله إلى المشاريع النشطة!', 'success');
  }

  /* ==========================================================================
     2. SALES MANAGEMENT EVENTS
     ========================================================================== */
  setupSalesEvents() {
    // Open modal buttons
    const openBtn = document.getElementById('openAddSaleModalBtn');
    if (openBtn) openBtn.addEventListener('click', () => ui.saleModal.show());

    const quickBtn = document.getElementById('quickAddSaleBtn');
    if (quickBtn) quickBtn.addEventListener('click', () => ui.saleModal.show());

    // Filter events
    const searchInp = document.getElementById('salesSearchInput');
    const filterBiz = document.getElementById('salesFilterBusiness');
    const filterStat = document.getElementById('salesFilterStatus');

    if (searchInp) searchInp.addEventListener('input', () => ui.renderSalesTable());
    if (filterBiz) filterBiz.addEventListener('change', () => ui.renderSalesTable());
    if (filterStat) filterStat.addEventListener('change', () => ui.renderSalesTable());

    // Sale calculation inputs
    const saleBiz = document.getElementById('saleBusinessSelect');
    const saleQty = document.getElementById('saleQuantity');
    const salePrice = document.getElementById('saleUnitPrice');
    const saleDisc = document.getElementById('saleDiscount');
    const saleExp = document.getElementById('saleDirectExpenses');
    const salePaid = document.getElementById('salePaidAmount');

    const updateStockNotice = () => {
      const bizId = saleBiz.value;
      if (!bizId) return;
      const m = store.getBusinessMetrics(bizId);
      const notice = document.getElementById('saleBizStockNotice');
      if (m && notice) {
        notice.innerHTML = `المخزون المتبقي: <strong>${m.remainingQuantity} قطعة</strong> (تكلفة القطعة: ${ui.formatMoney(m.unitCost)} د.ل)`;
        if (m.remainingQuantity <= 5) {
          notice.className = 'small mt-1 text-warning fw-bold';
        } else {
          notice.className = 'small mt-1 text-info';
        }
      }
    };

    saleBiz.addEventListener('change', () => {
      updateStockNotice();
      this.recalculateSaleModal();
    });

    [saleQty, salePrice, saleDisc, saleExp, salePaid].forEach(el => {
      if (el) el.addEventListener('input', () => this.recalculateSaleModal());
    });

    // Save Sale Button
    const saveSaleBtn = document.getElementById('saveSaleBtn');
    if (saveSaleBtn) {
      saveSaleBtn.addEventListener('click', () => this.handleSaveSale());
    }

    // Confirm Debt Payment Button
    const confirmDebtBtn = document.getElementById('confirmDebtPaymentBtn');
    if (confirmDebtBtn) {
      confirmDebtBtn.addEventListener('click', () => this.handleConfirmDebtPayment());
    }
  }

  recalculateSaleModal() {
    const bizId = document.getElementById('saleBusinessSelect').value;
    const qty = parseInt(document.getElementById('saleQuantity').value, 10) || 0;
    const price = parseFloat(document.getElementById('saleUnitPrice').value) || 0;
    const disc = parseFloat(document.getElementById('saleDiscount').value) || 0;
    const exp = parseFloat(document.getElementById('saleDirectExpenses').value) || 0;
    const paid = document.getElementById('salePaidAmount').value;

    const calc = store.calculateSaleAmounts(bizId, qty, price, disc, exp, paid === '' ? null : paid);

    document.getElementById('saleCalcTotal').textContent = `${ui.formatMoney(calc.totalAmount)} د.ل`;
    document.getElementById('saleCalcCogs').textContent = `${ui.formatMoney(calc.cogs)} د.ل`;
    document.getElementById('saleCalcProfit').textContent = `${ui.formatMoney(calc.netProfit)} د.ل`;
    document.getElementById('saleCalcRemaining').textContent = `المتبقي: ${ui.formatMoney(calc.remainingAmount)} د.ل`;

    const badge = document.getElementById('saleCalcStatusBadge');
    if (calc.paymentStatus === 'paid') {
      badge.className = 'badge badge-paid-full';
      badge.textContent = 'مدفوع بالكامل';
    } else if (calc.paymentStatus === 'partial') {
      badge.className = 'badge badge-paid-partial';
      badge.textContent = 'دفع جزئي';
    } else {
      badge.className = 'badge badge-paid-debt';
      badge.textContent = 'غير مدفوع (بالأجل)';
    }
  }

  handleSaveSale() {
    try {
      const bizId = document.getElementById('saleBusinessSelect').value;
      if (!bizId) throw new Error('يرجى اختيار المشروع أولاً.');

      const qty = parseInt(document.getElementById('saleQuantity').value, 10);
      const unitPrice = parseFloat(document.getElementById('saleUnitPrice').value);

      if (!qty || qty <= 0) throw new Error('يرجى تحديد كمية بيع صحيحة.');
      if (isNaN(unitPrice) || unitPrice < 0) throw new Error('يرجى تحديد سعر بيع صحيح.');

      const saleData = {
        businessId: bizId,
        customerName: document.getElementById('saleCustomerName').value,
        customerPhone: document.getElementById('saleCustomerPhone').value,
        saleDate: document.getElementById('saleDate').value || new Date().toISOString().split('T')[0],
        quantity: qty,
        unitPrice: unitPrice,
        discount: parseFloat(document.getElementById('saleDiscount').value) || 0,
        sellingExpenses: parseFloat(document.getElementById('saleDirectExpenses').value) || 0,
        paidAmount: document.getElementById('salePaidAmount').value === '' ? null : parseFloat(document.getElementById('salePaidAmount').value),
        notes: document.getElementById('saleNotes').value
      };

      const newSale = store.addSale(saleData);
      ui.saleModal.hide();
      document.getElementById('saleForm').reset();
      ui.showToast(`تم تسجيل الفاتورة (${newSale.invoiceNo}) وخصم ${newSale.quantity} قطعة من المخزون بنجاح!`, 'success');
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  }

  openDebtPayment(saleId) {
    const sale = store.state.sales.find(s => s.id === saleId);
    if (!sale) return;

    document.getElementById('debtSaleId').value = sale.id;
    document.getElementById('debtCustomerName').textContent = sale.customerName;
    document.getElementById('debtRemainingAmount').textContent = `${ui.formatMoney(sale.remainingAmount)} د.ل`;
    document.getElementById('debtPaymentAmount').value = sale.remainingAmount;

    ui.payDebtModal.show();
  }

  handleConfirmDebtPayment() {
    const saleId = document.getElementById('debtSaleId').value;
    const amount = parseFloat(document.getElementById('debtPaymentAmount').value) || 0;

    if (amount <= 0) {
      ui.showToast('يرجى إدخال مبلغ دفع صالح.', 'error');
      return;
    }

    const updated = store.recordPayment(saleId, amount);
    if (updated) {
      ui.payDebtModal.hide();
      ui.showToast(`تم تسجيل تحصيل دفعة بقيمة ${ui.formatMoney(amount)} د.ل بنجاح!`, 'success');
    }
  }

  deleteSale(saleId) {
    if (confirm('هل أنت متأكد من رغبتك في حذف عملية البيع هذه؟')) {
      store.deleteSale(saleId);
      ui.showToast('تم حذف عملية البيع وتحديث الحسابات', 'warning');
    }
  }

  /* ==========================================================================
     3. EXPENSES MANAGEMENT EVENTS
     ========================================================================== */
  setupExpensesEvents() {
    const openBtn = document.getElementById('openAddExpenseModalBtn');
    if (openBtn) openBtn.addEventListener('click', () => ui.expenseModal.show());

    const filterBiz = document.getElementById('expenseFilterBusiness');
    const filterCat = document.getElementById('expenseFilterCategory');
    if (filterBiz) filterBiz.addEventListener('change', () => ui.renderExpensesTable());
    if (filterCat) filterCat.addEventListener('change', () => ui.renderExpensesTable());

    // Expense Currency Switcher
    const expCurrLYD = document.getElementById('expCurrLYD');
    const expCurrUSD = document.getElementById('expCurrUSD');
    const expRateGroup = document.getElementById('expExchangeRateGroup');

    const toggleExpCurrency = () => {
      if (expCurrUSD.checked) {
        expRateGroup.classList.remove('d-none');
      } else {
        expRateGroup.classList.add('d-none');
      }
    };

    expCurrLYD.addEventListener('change', toggleExpCurrency);
    expCurrUSD.addEventListener('change', toggleExpCurrency);

    // Save Expense Button
    const saveBtn = document.getElementById('saveExpenseBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSaveExpense());
    }
  }

  handleSaveExpense() {
    const title = document.getElementById('expTitle').value.trim();
    const amount = parseFloat(document.getElementById('expAmount').value) || 0;

    if (!title || amount <= 0) {
      ui.showToast('يرجى إدخال بيان المصروف والمبلغ بشكل صحيح.', 'error');
      return;
    }

    const isUSD = document.getElementById('expCurrUSD').checked;
    const rate = parseFloat(document.getElementById('expExchangeRate').value) || store.state.settings.usdRate || 1;

    store.addExpense({
      title,
      category: document.getElementById('expCategory').value,
      businessId: document.getElementById('expBusiness').value,
      date: document.getElementById('expDate').value || new Date().toISOString().split('T')[0],
      currency: isUSD ? 'USD' : 'LYD',
      amount,
      exchangeRate: isUSD ? rate : 1,
      notes: document.getElementById('expNotes').value
    });

    ui.expenseModal.hide();
    document.getElementById('expenseForm').reset();
    document.getElementById('expCurrLYD').checked = true;
    document.getElementById('expCurrLYD').dispatchEvent(new Event('change'));
    ui.showToast('تم تسجيل المصروف بنجاح!', 'success');
  }

  deleteExpense(expId) {
    if (confirm('هل أنت متأكد من رغبتك في حذف هذا المصروف؟')) {
      store.deleteExpense(expId);
      ui.showToast('تم حذف المصروف بنجاح', 'warning');
    }
  }

  /* ==========================================================================
     4. SETTINGS & CLOUD SYNC EVENTS
     ========================================================================== */
  setupSettingsAndCloudEvents() {
    // Save Firebase Config
    const saveFbBtn = document.getElementById('saveFirebaseConfigBtn');
    if (saveFbBtn) {
      saveFbBtn.addEventListener('click', async () => {
        const config = {
          apiKey: document.getElementById('fbApiKey').value.trim(),
          authDomain: document.getElementById('fbAuthDomain').value.trim(),
          databaseURL: document.getElementById('fbDatabaseURL').value.trim(),
          projectId: document.getElementById('fbProjectId').value.trim()
        };

        if (!config.apiKey) {
          ui.showToast('يرجى إدخال مفتاح API Key على الأقل.', 'error');
          return;
        }

        // If databaseURL not set, try auto-generating from projectId
        if (!config.databaseURL && config.projectId) {
          config.databaseURL = `https://${config.projectId}-default-rtdb.firebaseio.com`;
          document.getElementById('fbDatabaseURL').value = config.databaseURL;
        }

        store.updateSettings({ firebaseConfig: config });
        const success = await firebaseService.init(config);
        if (success) {
          ui.showToast('تم حفظ إعدادات Firebase وتفعيل الاتصال السحابي بنجاح! ☁️', 'success');
        } else {
          ui.showToast('تعذر الاتصال بـ Firebase، يرجى مراجعة المفاتيح والاتصال.', 'error');
        }
      });
    }

    // Clear Firebase Config Button
    const clearFbBtn = document.getElementById('clearFirebaseConfigBtn');
    if (clearFbBtn) {
      clearFbBtn.addEventListener('click', async () => {
        if (confirm('هل أنت متأكد من رغبتك في مسح إعدادات Firebase والعودة للوضع المحلي؟')) {
          document.getElementById('fbApiKey').value = '';
          document.getElementById('fbAuthDomain').value = '';
          document.getElementById('fbDatabaseURL').value = '';
          document.getElementById('fbProjectId').value = '';
          store.updateSettings({ firebaseConfig: null });
          if (firebaseService.currentUser) {
            await firebaseService.logout();
          }
          firebaseService.updateStatusBadge(false, 'الوضع المحلي (Offline)');
          ui.showToast('تم مسح إعدادات السحابة، والتحويل إلى الوضع المحلي.', 'info');
        }
      });
    }

    // Manual Sync Button
    const topbarSyncBtn = document.getElementById('topbarSyncBtn');
    const testSyncBtn = document.getElementById('testSyncBtn');

    const triggerSync = async () => {
      if (!firebaseService.currentUser) {
        ui.showToast('أنت حالياً في الوضع المحلي (Offline). سجل الدخول لتفعيل المزامنة السحابية.', 'warning');
        if (ui.authModal) {
          ui.authModal.show();
        } else {
          ui.navigateTo('settings');
        }
        return;
      }
      await firebaseService.syncLocalToCloud();
    };

    if (topbarSyncBtn) topbarSyncBtn.addEventListener('click', triggerSync);
    if (testSyncBtn) testSyncBtn.addEventListener('click', triggerSync);

    // Sidebar Sync Pill Click
    const sidebarSyncPill = document.getElementById('sidebarSyncPill');
    if (sidebarSyncPill) {
      sidebarSyncPill.addEventListener('click', () => {
        if (!firebaseService.currentUser) {
          if (ui.authModal) ui.authModal.show();
          else ui.navigateTo('settings');
        } else {
          triggerSync();
        }
      });
    }

    // Modal Navigation Links
    const modalGoSettingsLink = document.getElementById('modalGoSettingsLink');
    if (modalGoSettingsLink) {
      modalGoSettingsLink.addEventListener('click', () => {
        ui.navigateTo('settings');
      });
    }

    const dropdownSettingsLink = document.getElementById('dropdownSettingsLink');
    if (dropdownSettingsLink) {
      dropdownSettingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        ui.navigateTo('settings');
      });
    }

    // Auth Buttons in Settings Page
    const loginEmailBtn = document.getElementById('loginEmailBtn');
    const registerEmailBtn = document.getElementById('registerEmailBtn');
    const loginGoogleBtn = document.getElementById('loginGoogleBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const dropdownLogoutBtn = document.getElementById('dropdownLogoutBtn');

    if (loginEmailBtn) {
      loginEmailBtn.addEventListener('click', async () => {
        const email = document.getElementById('authEmail').value;
        const pass = document.getElementById('authPassword').value;
        try {
          await firebaseService.loginEmailPassword(email, pass);
          ui.showToast('تم تسجيل الدخول بنجاح! مرحباً بك 🚀', 'success');
        } catch (e) {
          ui.showToast(e.message, 'error');
        }
      });
    }

    if (registerEmailBtn) {
      registerEmailBtn.addEventListener('click', async () => {
        const email = document.getElementById('authEmail').value;
        const pass = document.getElementById('authPassword').value;
        try {
          await firebaseService.registerEmailPassword(email, pass);
          ui.showToast('تم إنشاء الحساب وتسجيل الدخول سحابياً بنجاح! ☁️', 'success');
        } catch (e) {
          ui.showToast(e.message, 'error');
        }
      });
    }

    if (loginGoogleBtn) {
      loginGoogleBtn.addEventListener('click', async () => {
        try {
          await firebaseService.loginWithGoogle();
          ui.showToast('تم تسجيل الدخول بحساب Google بنجاح!', 'success');
        } catch (e) {
          ui.showToast(e.message, 'error');
        }
      });
    }

    const handleLogout = async () => {
      sessionStorage.removeItem('guestMode');
      await firebaseService.logout();
      ui.showAuthScreen();
      ui.showToast('تم تسجيل الخروج بنجاح. أنت الآن في شاشة البداية.', 'info');
    };

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (dropdownLogoutBtn) dropdownLogoutBtn.addEventListener('click', handleLogout);

    // ==========================================
    // Startup Landing Auth Screen Handlers
    // ==========================================
    const startupLoginForm = document.getElementById('startupLoginForm');
    if (startupLoginForm) {
      startupLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('startupLoginEmail').value;
        const pass = document.getElementById('startupLoginPassword').value;
        const submitBtn = document.getElementById('startupSubmitLoginBtn');
        try {
          if (submitBtn) submitBtn.disabled = true;
          await firebaseService.loginEmailPassword(email, pass);
          sessionStorage.removeItem('guestMode');
          ui.hideAuthScreen();
          ui.updateGuestBanner(false);
          ui.showToast('تم تسجيل الدخول بنجاح! مرحباً بك 🚀', 'success');
        } catch (err) {
          ui.showToast(err.message, 'error');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    const startupRegisterForm = document.getElementById('startupRegisterForm');
    if (startupRegisterForm) {
      startupRegisterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('startupRegEmail').value;
        const pass = document.getElementById('startupRegPassword').value;
        const confirm = document.getElementById('startupRegConfirmPassword').value;
        const submitBtn = document.getElementById('startupSubmitRegBtn');

        if (pass.length < 6) {
          ui.showToast('كلمة المرور يجب أن تتكون من 6 خانات أو أكثر.', 'error');
          return;
        }
        if (pass !== confirm) {
          ui.showToast('كلمة المرور وتأكيد كلمة المرور غير متطابقين!', 'error');
          return;
        }

        try {
          if (submitBtn) submitBtn.disabled = true;
          await firebaseService.registerEmailPassword(email, pass);
          sessionStorage.removeItem('guestMode');
          ui.hideAuthScreen();
          ui.updateGuestBanner(false);
          ui.showToast('تم إنشاء الحساب وتسجيل الدخول بنجاح! ☁️', 'success');
        } catch (err) {
          ui.showToast(err.message, 'error');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    const startupResetForm = document.getElementById('startupResetForm');
    if (startupResetForm) {
      startupResetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('startupResetEmail').value;
        const submitBtn = document.getElementById('startupSubmitResetBtn');
        try {
          if (submitBtn) submitBtn.disabled = true;
          await firebaseService.resetPassword(email);
          ui.showToast('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني! 📧', 'success');
        } catch (err) {
          ui.showToast(err.message, 'error');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    const startupGoogleLoginBtn = document.getElementById('startupGoogleLoginBtn');
    if (startupGoogleLoginBtn) {
      startupGoogleLoginBtn.addEventListener('click', async () => {
        try {
          await firebaseService.loginWithGoogle();
          sessionStorage.removeItem('guestMode');
          ui.hideAuthScreen();
          ui.updateGuestBanner(false);
          ui.showToast('تم تسجيل الدخول بحساب Google بنجاح!', 'success');
        } catch (err) {
          ui.showToast(err.message, 'error');
        }
      });
    }

    // ==========================================
    // Guest Mode & System Guide Handlers
    // ==========================================
    const enterGuestModeBtn = document.getElementById('enterGuestModeBtn');
    if (enterGuestModeBtn) {
      enterGuestModeBtn.addEventListener('click', () => {
        sessionStorage.setItem('guestMode', 'true');
        ui.hideAuthScreen();
        ui.updateGuestBanner(true);
        if (ui.systemGuideModal) {
          ui.systemGuideModal.show();
        } else {
          ui.showToast('مرحباً بك في وضع تجربة النظام كزائر! 🚀', 'info');
        }
      });
    }

    const openSystemGuideBtn = document.getElementById('openSystemGuideBtn');
    if (openSystemGuideBtn) {
      openSystemGuideBtn.addEventListener('click', () => {
        if (ui.systemGuideModal) ui.systemGuideModal.show();
      });
    }

    const bannerGuideBtn = document.getElementById('bannerGuideBtn');
    if (bannerGuideBtn) {
      bannerGuideBtn.addEventListener('click', () => {
        if (ui.systemGuideModal) ui.systemGuideModal.show();
      });
    }

    const bannerLoginBtn = document.getElementById('bannerLoginBtn');
    if (bannerLoginBtn) {
      bannerLoginBtn.addEventListener('click', () => {
        if (ui.authModal) {
          ui.authModal.show();
        } else {
          ui.showAuthScreen();
        }
      });
    }

    const guideGoLoginBtn = document.getElementById('guideGoLoginBtn');
    if (guideGoLoginBtn) {
      guideGoLoginBtn.addEventListener('click', () => {
        if (ui.systemGuideModal) ui.systemGuideModal.hide();
        ui.showAuthScreen();
      });
    }

    const guideStartGuestBtn = document.getElementById('guideStartGuestBtn');
    if (guideStartGuestBtn) {
      guideStartGuestBtn.addEventListener('click', () => {
        sessionStorage.setItem('guestMode', 'true');
        ui.hideAuthScreen();
        ui.updateGuestBanner(true);
        ui.showToast('أنت الآن تتصفح النظام كزائر. استكشف لوحة التحكم والمشاريع بحرية 🚀', 'info');
      });
    }

    // ==========================================
    // Modal Auth Handlers (Popup)
    // ==========================================
    const modalLoginForm = document.getElementById('modalLoginForm');
    if (modalLoginForm) {
      modalLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('modalLoginEmail').value;
        const pass = document.getElementById('modalLoginPassword').value;
        const submitBtn = document.getElementById('modalSubmitLoginBtn');
        try {
          if (submitBtn) submitBtn.disabled = true;
          await firebaseService.loginEmailPassword(email, pass);
          sessionStorage.removeItem('guestMode');
          ui.hideAuthScreen();
          ui.updateGuestBanner(false);
          ui.showToast('تم تسجيل الدخول بنجاح! مرحباً بك 🚀', 'success');
          if (ui.authModal) ui.authModal.hide();
        } catch (err) {
          ui.showToast(err.message, 'error');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    const modalRegisterForm = document.getElementById('modalRegisterForm');
    if (modalRegisterForm) {
      modalRegisterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('modalRegEmail').value;
        const pass = document.getElementById('modalRegPassword').value;
        const confirm = document.getElementById('modalRegConfirmPassword').value;
        const submitBtn = document.getElementById('modalSubmitRegBtn');

        if (pass.length < 6) {
          ui.showToast('كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل.', 'error');
          return;
        }
        if (pass !== confirm) {
          ui.showToast('كلمة المرور وتأكيد كلمة المرور غير متطابقين!', 'error');
          return;
        }

        try {
          if (submitBtn) submitBtn.disabled = true;
          await firebaseService.registerEmailPassword(email, pass);
          sessionStorage.removeItem('guestMode');
          ui.hideAuthScreen();
          ui.updateGuestBanner(false);
          ui.showToast('تم إنشاء الحساب وتسجيل الدخول بنجاح! ☁️', 'success');
          if (ui.authModal) ui.authModal.hide();
        } catch (err) {
          ui.showToast(err.message, 'error');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    const modalResetForm = document.getElementById('modalResetForm');
    if (modalResetForm) {
      modalResetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('modalResetEmail').value;
        const submitBtn = document.getElementById('modalSubmitResetBtn');
        try {
          if (submitBtn) submitBtn.disabled = true;
          await firebaseService.resetPassword(email);
          ui.showToast('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني! 📧', 'success');
        } catch (err) {
          ui.showToast(err.message, 'error');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    const modalGoogleLoginBtn = document.getElementById('modalGoogleLoginBtn');
    if (modalGoogleLoginBtn) {
      modalGoogleLoginBtn.addEventListener('click', async () => {
        try {
          await firebaseService.loginWithGoogle();
          sessionStorage.removeItem('guestMode');
          ui.hideAuthScreen();
          ui.updateGuestBanner(false);
          ui.showToast('تم تسجيل الدخول بحساب Google بنجاح!', 'success');
          if (ui.authModal) ui.authModal.hide();
        } catch (err) {
          ui.showToast(err.message, 'error');
        }
      });
    }

    // General Settings (Exchange rate)
    const saveGenBtn = document.getElementById('saveGeneralSettingsBtn');
    if (saveGenBtn) {
      saveGenBtn.addEventListener('click', () => {
        const rate = parseFloat(document.getElementById('settingUsdRate').value) || 7.25;
        store.updateSettings({ usdRate: rate });
        ui.showToast('تم حفظ سعر الصرف الافتراضي بنجاح', 'success');
      });
    }

    // Backup & Restore
    const downloadBtn = document.getElementById('downloadBackupBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const json = store.exportBackup();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `business_hub_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    const importInp = document.getElementById('importBackupFile');
    if (importInp) {
      importInp.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            store.importBackup(evt.target.result);
            ui.showToast('تمت استعادة كافة البيانات بنجاح!', 'success');
          } catch (err) {
            ui.showToast(err.message, 'error');
          }
        };
        reader.readAsText(file);
      });
    }

    // Demo Data & Reset
    const reloadDemoBtn = document.getElementById('reloadDemoDataBtn');
    if (reloadDemoBtn) {
      reloadDemoBtn.addEventListener('click', () => {
        if (confirm('هل تريد إعادة شحن البيانات التجريبية الشاملة للمشاريع والمبيعات؟')) {
          store.seedDemoData();
          ui.showToast('تم شحن البيانات التجريبية بنجاح!', 'success');
        }
      });
    }

    const resetAllBtn = document.getElementById('resetAllDataBtn');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', () => {
        if (confirm('تحذير نهائي: هل أنت متأكد من رغبتك في مسح كافة المشاريع والمبيعات والمصروفات؟ لا يمكن التراجع!')) {
          store.resetAllData();
          ui.showToast('تم تصفير كافة بيانات النظام.', 'warning');
        }
      });
    }

    // Export CSV Button
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => this.exportSalesCSV());
    }
  }

  exportSalesCSV() {
    const sales = store.state.sales;
    if (sales.length === 0) {
      ui.showToast('لا توجد مبيعات لتصديرها.', 'warning');
      return;
    }

    let csv = '\uFEFFرقم الفاتورة,التاريخ,المشروع,المنتج,الزبون,الهاتف,الكمية,سعر القطعة,الإجمالي,التكلفة COGS,صافي الربح,حالة الدفع,المتبقي\n';

    sales.forEach(s => {
      csv += `"${s.invoiceNo}","${s.saleDate}","${s.businessName}","${s.productName}","${s.customerName}","${s.customerPhone || ''}","${s.quantity}","${s.unitPrice}","${s.totalAmount}","${s.cogs}","${s.netProfit}","${s.paymentStatus}","${s.remainingAmount}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    ui.showToast('تم تصدير ملف CSV بنجاح', 'success');
  }

  setupQuickButtons() {
    const brandLink = document.getElementById('brandLink');
    if (brandLink) {
      brandLink.addEventListener('click', (e) => {
        e.preventDefault();
        ui.navigateTo('dashboard');
      });
    }
  }
}

// Global App Instance
const app = new AppController();

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
