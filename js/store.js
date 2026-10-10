/**
 * store.js - Business & E-Commerce Management System Data Store
 * Handles Data State, Accounting Logic, Calculations, and LocalStorage / Offline Persistence.
 */

class DataStore {
  constructor() {
    this.STORAGE_KEY = 'mng_ecommerce_data_v1';
    this.state = {
      businesses: [],
      sales: [],
      expenses: [],
      settings: {
        currency: 'د.ل',
        usdRate: 7.25, // سعر صرف افتراضي للدولار مقابل الدينار الليبي
        theme: 'dark-emerald',
        firebaseConfig: null,
        enableAutoSync: false
      }
    };
    this.listeners = [];
    this.init();
  }

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed };
      } catch (e) {
        console.error('Failed to parse saved state:', e);
        this.seedDemoData();
      }
    } else {
      this.seedDemoData();
    }
  }

  save() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach(cb => {
      try {
        cb(this.state);
      } catch (err) {
        console.error('Listener callback error:', err);
      }
    });
  }

  generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /* ==========================================================================
     BUSINESS MANAGEMENT LOGIC
     ========================================================================== */

  /**
   * Calculate business capital breakdown and unit cost
   */
  calculateBusinessCapital(data) {
    // 1. تكلفة الشراء الأساسية للبضاعة
    let purchaseCostLYD = 0;
    const isUSD = data.currencyMode === 'usd_lyd';
    const rate = parseFloat(data.exchangeRate) || 1;
    const initialQty = parseInt(data.totalQuantity, 10) || 1;

    if (isUSD) {
      const priceUSD = parseFloat(data.purchasePriceUSD) || 0;
      purchaseCostLYD = priceUSD * rate;
    } else {
      purchaseCostLYD = parseFloat(data.purchasePriceLYD) || 0;
    }

    // 2. تكلفة الشحن المتقدمة
    let shippingCostLYD = 0;
    const shippingType = data.shippingType || 'sea'; // 'sea' or 'air'
    const shippingCurrencyMode = data.shippingCurrencyMode || 'lyd';
    const shippingRate = parseFloat(data.shippingExchangeRate) || rate;

    if (data.customShippingCostManual !== undefined && data.customShippingCostManual !== null && data.customShippingCostManual !== '') {
      // تعديل مباشر لتكلفة الشحن
      shippingCostLYD = parseFloat(data.customShippingCostManual) || 0;
    } else {
      if (shippingType === 'sea') {
        const cbm = parseFloat(data.seaCbm) || 0;
        const ratePerCbm = parseFloat(data.seaRatePerCbm) || 0;
        let total = cbm * ratePerCbm;
        shippingCostLYD = shippingCurrencyMode === 'usd_lyd' ? (total * shippingRate) : total;
      } else {
        const weightKg = parseFloat(data.airWeightKg) || 0;
        const ratePerKg = parseFloat(data.airRatePerKg) || 0;
        let total = weightKg * ratePerKg;
        shippingCostLYD = shippingCurrencyMode === 'usd_lyd' ? (total * shippingRate) : total;
      }
    }

    // 3. التكاليف الإضافية الديناميكية
    let extraCostsTotal = 0;
    if (Array.isArray(data.extraCosts)) {
      extraCostsTotal = data.extraCosts.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    }

    // 4. تكاليف الإعلانات التأسيسية
    let marketingCostLYD = 0;
    if (data.enableMarketing) {
      if (data.marketingCurrencyMode === 'usd') {
        const costUSD = parseFloat(data.marketingCostUSD) || 0;
        const mRate = parseFloat(data.marketingExchangeRate) || 1;
        marketingCostLYD = costUSD * mRate;
      } else {
        marketingCostLYD = parseFloat(data.marketingCostLYD) || 0;
      }
    }

    // 5. إجمالي رأس المال المستثمر (شراء + شحن + تكاليف إضافية + إعلانات تأسيسية)
    const totalCapital = purchaseCostLYD + shippingCostLYD + extraCostsTotal + marketingCostLYD;

    // 6. متوسط تكلفة القطعة الواحدة
    const unitCost = initialQty > 0 ? (totalCapital / initialQty) : 0;

    return {
      purchaseCostLYD: Math.round(purchaseCostLYD * 100) / 100,
      shippingCostLYD: Math.round(shippingCostLYD * 100) / 100,
      extraCostsTotal: Math.round(extraCostsTotal * 100) / 100,
      marketingCostLYD: Math.round(marketingCostLYD * 100) / 100,
      totalCapital: Math.round(totalCapital * 100) / 100,
      unitCost: Math.round(unitCost * 100) / 100,
      initialQuantity: initialQty
    };
  }

  addBusiness(bizData) {
    const calc = this.calculateBusinessCapital(bizData);
    const newBiz = {
      id: this.generateId('biz'),
      name: bizData.name.trim(),
      productName: bizData.productName.trim(),
      origin: bizData.origin || 'libya', // 'libya' or 'china'
      purchaseDate: bizData.purchaseDate || new Date().toISOString().split('T')[0],
      description: bizData.description || '',
      imageUrl: bizData.imageUrl || '',
      totalQuantity: calc.initialQuantity,
      currencyMode: bizData.currencyMode || 'lyd',
      purchasePriceLYD: bizData.purchasePriceLYD || 0,
      purchasePriceUSD: bizData.purchasePriceUSD || 0,
      exchangeRate: bizData.exchangeRate || 1,
      shippingType: bizData.shippingType || 'sea',
      shippingCurrencyMode: bizData.shippingCurrencyMode || 'lyd',
      shippingExchangeRate: bizData.shippingExchangeRate || 1,
      seaCbm: bizData.seaCbm || 0,
      seaRatePerCbm: bizData.seaRatePerCbm || 0,
      airWeightKg: bizData.airWeightKg || 0,
      airRatePerKg: bizData.airRatePerKg || 0,
      customShippingCostManual: bizData.customShippingCostManual || null,
      extraCosts: Array.isArray(bizData.extraCosts) ? bizData.extraCosts : [],
      enableMarketing: !!bizData.enableMarketing,
      marketingCurrencyMode: bizData.marketingCurrencyMode || 'lyd',
      marketingCostLYD: calc.marketingCostLYD,
      marketingCostUSD: bizData.marketingCostUSD || 0,
      marketingExchangeRate: bizData.marketingExchangeRate || 1,
      // Calculated Fields
      totalCapital: calc.totalCapital,
      unitCost: calc.unitCost,
      status: 'active', // 'active' or 'closed'
      createdAt: new Date().toISOString()
    };

    this.state.businesses.unshift(newBiz);
    this.save();
    return newBiz;
  }

  updateBusiness(id, updateData) {
    const index = this.state.businesses.findIndex(b => b.id === id);
    if (index === -1) return null;

    const calc = this.calculateBusinessCapital(updateData);
    const updatedBiz = {
      ...this.state.businesses[index],
      ...updateData,
      totalCapital: calc.totalCapital,
      unitCost: calc.unitCost,
      updatedAt: new Date().toISOString()
    };
    this.state.businesses[index] = updatedBiz;
    this.state.expenses = this.state.expenses.filter(e => e.id !== `exp_mkt_${id}`);

    this.save();
    return this.state.businesses[index];
  }

  archiveBusiness(id) {
    const biz = this.state.businesses.find(b => b.id === id);
    if (biz) {
      biz.status = 'closed';
      biz.closedAt = new Date().toISOString();
      this.save();
    }
  }

  restoreBusiness(id) {
    const biz = this.state.businesses.find(b => b.id === id);
    if (biz) {
      biz.status = 'active';
      this.save();
    }
  }

  deleteBusiness(id) {
    // Cascade delete or check sales
    this.state.businesses = this.state.businesses.filter(b => b.id !== id);
    this.state.sales = this.state.sales.filter(s => s.businessId !== id);
    this.state.expenses = this.state.expenses.filter(e => e.businessId !== id);
    this.save();
  }

  getBusinessById(id) {
    return this.state.businesses.find(b => b.id === id) || null;
  }

  /**
   * Get detailed metrics for a business
   */
  getBusinessMetrics(businessId) {
    const biz = this.getBusinessById(businessId);
    if (!biz) return null;

    const sales = this.state.sales.filter(s => s.businessId === businessId);
    const expenses = this.state.expenses.filter(e => e.businessId === businessId);

    const soldQuantity = sales.reduce((acc, s) => acc + (parseInt(s.quantity, 10) || 0), 0);
    const remainingQuantity = Math.max(0, biz.totalQuantity - soldQuantity);
    const remainingStockValue = remainingQuantity * (biz.unitCost || 0);

    const totalSalesRevenue = sales.reduce((acc, s) => acc + (parseFloat(s.totalAmount) || 0), 0);
    const totalCollected = sales.reduce((acc, s) => acc + (parseFloat(s.paidAmount) || 0), 0);
    const totalDebts = sales.reduce((acc, s) => acc + (parseFloat(s.remainingAmount) || 0), 0);

    const totalCOGS = sales.reduce((acc, s) => acc + (parseFloat(s.cogs) || 0), 0);
    const totalDirectSellingExpenses = sales.reduce((acc, s) => acc + (parseFloat(s.sellingExpenses) || 0), 0);
    const totalOperatingExpenses = expenses.reduce((acc, e) => acc + (parseFloat(e.amountLYD) || 0), 0);

    // صافي الربح الفعلي بعد استرداد كامل رأس المال المستثمر في المشروع والمصاريف الإضافية
    const realizedNetProfit = totalSalesRevenue - (biz.totalCapital || 0) - totalOperatingExpenses;
    const profitMargin = totalSalesRevenue > 0 ? (realizedNetProfit / totalSalesRevenue) * 100 : 0;
    const roi = biz.totalCapital > 0 ? (realizedNetProfit / biz.totalCapital) * 100 : 0;

    const avgProfitPerUnit = soldQuantity > 0 ? (realizedNetProfit / soldQuantity) : 0;

    return {
      biz,
      initialQuantity: biz.totalQuantity,
      soldQuantity,
      remainingQuantity,
      remainingStockValue: Math.round(remainingStockValue * 100) / 100,
      stockSoldPercent: biz.totalQuantity > 0 ? Math.min(100, Math.round((soldQuantity / biz.totalQuantity) * 100)) : 0,
      totalCapital: biz.totalCapital,
      unitCost: biz.unitCost,
      totalSalesRevenue: Math.round(totalSalesRevenue * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalDebts: Math.round(totalDebts * 100) / 100,
      totalCOGS: Math.round(totalCOGS * 100) / 100,
      totalDirectSellingExpenses: Math.round(totalDirectSellingExpenses * 100) / 100,
      totalOperatingExpenses: Math.round(totalOperatingExpenses * 100) / 100,
      realizedNetProfit: Math.round(realizedNetProfit * 100) / 100,
      avgProfitPerUnit: Math.round(avgProfitPerUnit * 100) / 100,
      profitMargin: Math.round(profitMargin * 10) / 10,
      roi: Math.round(roi * 10) / 10,
      salesCount: sales.length,
      expensesCount: expenses.length
    };
  }

  /* ==========================================================================
     SALES MANAGEMENT LOGIC
     ========================================================================== */

  /**
   * Calculate sale fields automatically
   */
  calculateSaleAmounts(businessId, quantity, unitPrice, discount = 0, directExpenses = 0, paidAmount = null) {
    const biz = this.getBusinessById(businessId);
    const qty = parseInt(quantity, 10) || 0;
    const price = parseFloat(unitPrice) || 0;
    const disc = parseFloat(discount) || 0;
    const exp = parseFloat(directExpenses) || 0;
    const unitCost = biz ? (biz.unitCost || 0) : 0;

    const subtotal = qty * price;
    const totalAmount = Math.max(0, subtotal - disc);
    const cogs = qty * unitCost;
    const netProfit = totalAmount - cogs - exp;

    let paid = paidAmount !== null && paidAmount !== '' ? parseFloat(paidAmount) : totalAmount;
    if (isNaN(paid)) paid = 0;
    paid = Math.max(0, paid);
    const remainingAmount = Math.max(0, totalAmount - paid);

    let paymentStatus = 'paid';
    if (paid >= totalAmount && totalAmount > 0) {
      paymentStatus = 'paid';
    } else if (paid > 0 && paid < totalAmount) {
      paymentStatus = 'partial';
    } else if (paid === 0 && totalAmount > 0) {
      paymentStatus = 'debt';
    }

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      sellingExpenses: Math.round(exp * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      paidAmount: Math.round(paid * 100) / 100,
      remainingAmount: Math.round(remainingAmount * 100) / 100,
      paymentStatus
    };
  }

  addSale(saleData) {
    const biz = this.getBusinessById(saleData.businessId);
    if (!biz) {
      throw new Error('البزنس المحدد غير موجود.');
    }

    // Check available stock
    const metrics = this.getBusinessMetrics(saleData.businessId);
    const requestedQty = parseInt(saleData.quantity, 10) || 0;

    if (requestedQty <= 0) {
      throw new Error('يرجى تحديد كمية بيع صحيحة أكبر من الصفر.');
    }

    if (requestedQty > metrics.remainingQuantity) {
      throw new Error(`الكمية المطلوبة (${requestedQty}) تتجاوز المخزون المتاح (${metrics.remainingQuantity} قطعة).`);
    }

    const calc = this.calculateSaleAmounts(
      saleData.businessId,
      requestedQty,
      saleData.unitPrice,
      saleData.discount,
      saleData.sellingExpenses,
      saleData.paidAmount
    );

    const newSale = {
      id: this.generateId('sale'),
      invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
      businessId: saleData.businessId,
      businessName: biz.name,
      productName: biz.productName,
      customerName: (saleData.customerName || 'زبون عام').trim(),
      customerPhone: (saleData.customerPhone || '').trim(),
      saleDate: saleData.saleDate || new Date().toISOString().split('T')[0],
      quantity: requestedQty,
      unitPrice: parseFloat(saleData.unitPrice) || 0,
      discount: parseFloat(saleData.discount) || 0,
      sellingExpenses: calc.sellingExpenses,
      subtotal: calc.subtotal,
      totalAmount: calc.totalAmount,
      cogs: calc.cogs,
      netProfit: calc.netProfit,
      paidAmount: calc.paidAmount,
      remainingAmount: calc.remainingAmount,
      paymentStatus: calc.paymentStatus,
      notes: saleData.notes || '',
      createdAt: new Date().toISOString()
    };

    this.state.sales.unshift(newSale);
    this.save();
    return newSale;
  }

  updateSale(saleId, saleData) {
    const saleIndex = this.state.sales.findIndex(s => s.id === saleId);
    if (saleIndex === -1) {
      throw new Error('عملية البيع غير موجودة.');
    }
    const oldSale = this.state.sales[saleIndex];
    const biz = this.getBusinessById(saleData.businessId);
    if (!biz) {
      throw new Error('البزنس المحدد غير موجود.');
    }

    const metrics = this.getBusinessMetrics(saleData.businessId);
    const requestedQty = parseInt(saleData.quantity, 10) || 0;
    if (requestedQty <= 0) {
      throw new Error('يرجى تحديد كمية بيع صحيحة أكبر من الصفر.');
    }

    // Available stock including the quantity from the sale being updated
    const oldQtyForSameBiz = oldSale.businessId === saleData.businessId ? (parseInt(oldSale.quantity, 10) || 0) : 0;
    const maxAvailable = metrics.remainingQuantity + oldQtyForSameBiz;
    if (requestedQty > maxAvailable) {
      throw new Error(`الكمية المطلوبة (${requestedQty}) تتجاوز المخزون المتاح (${maxAvailable} قطعة).`);
    }

    const calc = this.calculateSaleAmounts(
      saleData.businessId,
      requestedQty,
      saleData.unitPrice,
      saleData.discount,
      saleData.sellingExpenses,
      saleData.paidAmount
    );

    const updatedSale = {
      ...oldSale,
      businessId: saleData.businessId,
      businessName: biz.name,
      productName: biz.productName,
      customerName: (saleData.customerName || 'زبون عام').trim(),
      customerPhone: (saleData.customerPhone || '').trim(),
      saleDate: saleData.saleDate || oldSale.saleDate,
      quantity: requestedQty,
      unitPrice: parseFloat(saleData.unitPrice) || 0,
      discount: parseFloat(saleData.discount) || 0,
      sellingExpenses: calc.sellingExpenses,
      subtotal: calc.subtotal,
      totalAmount: calc.totalAmount,
      cogs: calc.cogs,
      netProfit: calc.netProfit,
      paidAmount: calc.paidAmount,
      remainingAmount: calc.remainingAmount,
      paymentStatus: calc.paymentStatus,
      notes: saleData.notes || '',
      updatedAt: new Date().toISOString()
    };

    this.state.sales[saleIndex] = updatedSale;
    this.save();
    return updatedSale;
  }

  recordPayment(saleId, paymentAmount) {
    const sale = this.state.sales.find(s => s.id === saleId);
    if (!sale) return null;

    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) return sale;

    sale.paidAmount = Math.min(sale.totalAmount, (sale.paidAmount || 0) + amount);
    sale.remainingAmount = Math.max(0, sale.totalAmount - sale.paidAmount);

    if (sale.remainingAmount === 0) {
      sale.paymentStatus = 'paid';
    } else {
      sale.paymentStatus = 'partial';
    }

    sale.updatedAt = new Date().toISOString();
    this.save();
    return sale;
  }

  deleteSale(id) {
    this.state.sales = this.state.sales.filter(s => s.id !== id);
    this.save();
  }

  /* ==========================================================================
     EXPENSES MANAGEMENT LOGIC
     ========================================================================== */

  addExpense(expData) {
    const isUSD = expData.currency === 'USD';
    const amount = parseFloat(expData.amount) || 0;
    const rate = parseFloat(expData.exchangeRate) || this.state.settings.usdRate || 1;
    const amountLYD = isUSD ? (amount * rate) : amount;

    let bizName = 'مصروف عام (مشترك)';
    if (expData.businessId && expData.businessId !== 'all') {
      const biz = this.getBusinessById(expData.businessId);
      if (biz) bizName = biz.name;
    }

    const newExpense = {
      id: this.generateId('exp'),
      title: expData.title.trim(),
      category: expData.category || 'marketing', // marketing, packaging, delivery, returns, salaries, other
      businessId: expData.businessId || 'all',
      businessName: bizName,
      date: expData.date || new Date().toISOString().split('T')[0],
      currency: expData.currency || 'LYD',
      amount: amount,
      exchangeRate: isUSD ? rate : 1,
      amountLYD: Math.round(amountLYD * 100) / 100,
      notes: expData.notes || '',
      createdAt: new Date().toISOString()
    };

    this.state.expenses.unshift(newExpense);
    this.save();
    return newExpense;
  }

  deleteExpense(id) {
    this.state.expenses = this.state.expenses.filter(e => e.id !== id);
    this.save();
  }

  /* ==========================================================================
     SYSTEM WIDE AGGREGATE CALCULATIONS
     ========================================================================== */

  getGlobalDashboardStats() {
    const activeBusinesses = this.state.businesses.filter(b => b.status === 'active');
    
    // 1. حساب رأس المال الإجمالي لجميع المشاريع المسجلة
    const allBusinesses = this.state.businesses;
    const totalCapital = allBusinesses.reduce((sum, b) => sum + (parseFloat(b.totalCapital) || 0), 0);

    // 2. إجمالي المبيعات المحققة
    const totalSalesRevenue = this.state.sales.reduce((sum, s) => sum + (parseFloat(s.totalAmount) || 0), 0);

    // 3. إجمالي المبالغ المحصلة والديون
    const totalCollected = this.state.sales.reduce((sum, s) => sum + (parseFloat(s.paidAmount) || 0), 0);
    const totalDebts = this.state.sales.reduce((sum, s) => sum + (parseFloat(s.remainingAmount) || 0), 0);

    // 4. تكلفة البضاعة المباعة COGS والمصاريف المباشرة
    const totalCOGS = this.state.sales.reduce((sum, s) => sum + (parseFloat(s.cogs) || 0), 0);
    const totalDirectSellingExpenses = this.state.sales.reduce((sum, s) => sum + (parseFloat(s.sellingExpenses) || 0), 0);

    // 5. المصروفات التشغيلية والتسويقية
    // تكلفة الإعلانات الممولة من المشاريع المسجلة
    const bizMarketingTotal = allBusinesses.reduce((sum, b) => sum + (b.enableMarketing ? (parseFloat(b.marketingCostLYD) || 0) : 0), 0);
    // تكلفة الإعلانات من المصروفات التشغيلية العامة المسجلة
    const expMarketingTotal = this.state.expenses
      .filter(e => e.category === 'marketing')
      .reduce((sum, e) => sum + (parseFloat(e.amountLYD) || 0), 0);
    const totalMarketingCost = bizMarketingTotal + expMarketingTotal;

    const totalOperatingExpenses = this.state.expenses.reduce((sum, e) => sum + (parseFloat(e.amountLYD) || 0), 0);
    // إجمالي المصروفات الكلية المعروضة في الداشبورد تشمل (المصروفات التشغيلية + مصاريف البيع + إعلانات المشاريع الممولة)
    const totalExpenses = totalOperatingExpenses + totalDirectSellingExpenses + bizMarketingTotal;

    // 6. صافي الأرباح المحققة:
    // بما أن رأس المال المستثمر في المشروع يحتوي على (الشراء + الشحن + الإضافية + الإعلانات)
    // فإن: المبيعات - رأس المال الإجمالي - المصروفات التشغيلية العامة (بدون تكرار خصم إعلانات المشروع مرتين)
    let netProfit = 0;
    if (totalCapital > 0) {
      netProfit = totalSalesRevenue - totalCapital - (totalOperatingExpenses + totalDirectSellingExpenses);
    } else {
      netProfit = totalSalesRevenue - totalCOGS - totalExpenses;
    }

    const profitMargin = totalSalesRevenue > 0 ? (netProfit / totalSalesRevenue) * 100 : 0;

    // قيمة المخزون المتبقي لجميع المشاريع
    let remainingStockValue = 0;
    allBusinesses.forEach(biz => {
      const metrics = this.getBusinessMetrics(biz.id);
      if (metrics) remainingStockValue += metrics.remainingStockValue;
    });

    return {
      totalCapital: Math.round(totalCapital * 100) / 100,
      totalSalesRevenue: Math.round(totalSalesRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalMarketingCost: Math.round(totalMarketingCost * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      profitMargin: Math.round(profitMargin * 10) / 10,
      remainingStockValue: Math.round(remainingStockValue * 100) / 100,
      totalDebts: Math.round(totalDebts * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      activeBusinessesCount: activeBusinesses.length,
      allBusinessesCount: allBusinesses.length,
      closedBusinessesCount: this.state.businesses.filter(b => b.status === 'closed').length,
      totalSalesCount: this.state.sales.length
    };
  }

  /* ==========================================================================
     SETTINGS & BACKUP
     ========================================================================== */

  updateSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    this.save();
  }

  exportBackup() {
    return JSON.stringify(this.state, null, 2);
  }

  importBackup(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.businesses || !data.sales) {
        throw new Error('صيغة ملف النسخة الاحتياطية غير صالحة.');
      }
      this.state = data;
      this.save();
      return true;
    } catch (e) {
      throw new Error('فشل استيراد النسخة الاحتياطية: ' + e.message);
    }
  }

  resetAllData() {
    this.state = {
      businesses: [],
      sales: [],
      expenses: [],
      settings: {
        currency: 'د.ل',
        usdRate: 7.25,
        theme: 'dark-emerald',
        firebaseConfig: null,
        enableAutoSync: false
      }
    };
    this.save();
  }

  /* ==========================================================================
     DEMO DATA SEEDING (لتبدأ الواجهة مفعمة بالبيانات الحية المترابطة)
     ========================================================================== */
  seedDemoData() {
    const biz1 = {
      id: 'biz_demo_1',
      name: 'متجر الساعات الذكية Ultra Smart',
      productName: 'ساعة ذكية SmartWatch T900 Ultra',
      origin: 'china',
      purchaseDate: '2026-09-10',
      description: 'استيراد حاوية ساعات ذكية بشاشة AMOLED ومقاومة للماء مع أساور إضافية.',
      imageUrl: '',
      totalQuantity: 200,
      currencyMode: 'usd_lyd',
      purchasePriceLYD: 0,
      purchasePriceUSD: 2400, // 12$ للقطعة × 200
      exchangeRate: 7.20,
      shippingType: 'air',
      shippingCurrencyMode: 'usd_lyd',
      shippingExchangeRate: 7.20,
      airWeightKg: 40,
      airRatePerKg: 10, // 400$
      seaCbm: 0,
      seaRatePerCbm: 0,
      customShippingCostManual: null,
      extraCosts: [
        { name: 'تغليف هدايا وأكياس فاخرة', amount: 350 },
        { name: 'فحص جودة ونقل محلي للمخزن', amount: 200 }
      ],
      enableMarketing: true,
      marketingCostLYD: 800,
      totalCapital: 0, // will calculate
      unitCost: 0,
      status: 'active',
      createdAt: '2026-09-10T10:00:00.000Z'
    };

    const biz2 = {
      id: 'biz_demo_2',
      name: 'سماعات Pro Wireless Audio',
      productName: 'سماعة بلوتوث Pro 5 ANC إلغاء الضوضاء',
      origin: 'china',
      purchaseDate: '2026-09-15',
      description: 'دفعة استيراد شحن بحري متميزة.',
      imageUrl: '',
      totalQuantity: 150,
      currencyMode: 'usd_lyd',
      purchasePriceLYD: 0,
      purchasePriceUSD: 1350, // 9$ للقطعة × 150
      exchangeRate: 7.20,
      shippingType: 'sea',
      shippingCurrencyMode: 'usd_lyd',
      shippingExchangeRate: 7.20,
      seaCbm: 0.6,
      seaRatePerCbm: 280, // 168$
      airWeightKg: 0,
      airRatePerKg: 0,
      customShippingCostManual: null,
      extraCosts: [
        { name: 'ملصقات الباركود والعلامة التجارية', amount: 180 }
      ],
      enableMarketing: true,
      marketingCostLYD: 650,
      totalCapital: 0,
      unitCost: 0,
      status: 'active',
      createdAt: '2026-09-15T11:00:00.000Z'
    };

    // حساب رأس المال
    const calc1 = this.calculateBusinessCapital(biz1);
    biz1.totalCapital = calc1.totalCapital;
    biz1.unitCost = calc1.unitCost;

    const calc2 = this.calculateBusinessCapital(biz2);
    biz2.totalCapital = calc2.totalCapital;
    biz2.unitCost = calc2.unitCost;

    this.state.businesses = [biz1, biz2];

    // مبيعات تجريبية
    this.state.sales = [
      {
        id: 'sale_demo_1',
        invoiceNo: 'INV-100201',
        businessId: 'biz_demo_1',
        businessName: biz1.name,
        productName: biz1.productName,
        customerName: 'محمد الطاهر (طرابلس)',
        customerPhone: '0912345678',
        saleDate: '2026-09-20',
        quantity: 15,
        unitPrice: 195,
        discount: 50,
        subtotal: 2925,
        totalAmount: 2875,
        cogs: 15 * biz1.unitCost,
        sellingExpenses: 60, // توصيل
        netProfit: 2875 - (15 * biz1.unitCost) - 60,
        paidAmount: 2875,
        remainingAmount: 0,
        paymentStatus: 'paid',
        notes: 'دفع نقدي فوري عند الاستلام',
        createdAt: '2026-09-20T14:30:00.000Z'
      },
      {
        id: 'sale_demo_2',
        invoiceNo: 'INV-100202',
        businessId: 'biz_demo_1',
        businessName: biz1.name,
        productName: biz1.productName,
        customerName: 'متجر الإلكترونيات الحديثة (بنغازي)',
        customerPhone: '0925556677',
        saleDate: '2026-09-22',
        quantity: 35,
        unitPrice: 175,
        discount: 100,
        subtotal: 6125,
        totalAmount: 6025,
        cogs: 35 * biz1.unitCost,
        sellingExpenses: 120,
        netProfit: 6025 - (35 * biz1.unitCost) - 120,
        paidAmount: 4000,
        remainingAmount: 2025,
        paymentStatus: 'partial',
        notes: 'دفعة أولى 4000 د.ل والمتبقي خلال 10 أيام',
        createdAt: '2026-09-22T16:00:00.000Z'
      },
      {
        id: 'sale_demo_3',
        invoiceNo: 'INV-100203',
        businessId: 'biz_demo_2',
        businessName: biz2.name,
        productName: biz2.productName,
        customerName: 'سفيان الورفلي (مصراتة)',
        customerPhone: '0943334455',
        saleDate: '2026-09-24',
        quantity: 20,
        unitPrice: 160,
        discount: 0,
        subtotal: 3200,
        totalAmount: 3200,
        cogs: 20 * biz2.unitCost,
        sellingExpenses: 80,
        netProfit: 3200 - (20 * biz2.unitCost) - 80,
        paidAmount: 0,
        remainingAmount: 3200,
        paymentStatus: 'debt',
        notes: 'بيع بالأجل (أمانة لمعرض)',
        createdAt: '2026-09-24T18:15:00.000Z'
      }
    ];

    // مصروفات تجريبية
    this.state.expenses = [
      {
        id: 'exp_demo_1',
        title: 'حملة إعلانات تيك توك وفيسبوك أسبوعية',
        category: 'marketing',
        businessId: 'biz_demo_1',
        businessName: biz1.name,
        date: '2026-09-21',
        currency: 'LYD',
        amount: 450,
        exchangeRate: 1,
        amountLYD: 450,
        notes: 'حملة ممولة لزيادة المبيعات',
        createdAt: '2026-09-21T12:00:00.000Z'
      },
      {
        id: 'exp_demo_2',
        title: 'صناديق كرتون شحن وتغليف إضافية',
        category: 'packaging',
        businessId: 'biz_demo_2',
        businessName: biz2.name,
        date: '2026-09-23',
        currency: 'LYD',
        amount: 190,
        exchangeRate: 1,
        amountLYD: 190,
        notes: 'تغليف طلبات التوصيل',
        createdAt: '2026-09-23T15:00:00.000Z'
      }
    ];

    this.save();
  }
}

// Global Store Instance
const store = new DataStore();
