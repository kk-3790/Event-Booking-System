// Utility to safely load and open the official Razorpay Checkout SDK popup

export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const launchRazorpayCheckout = async ({
  orderData,
  user,
  eventName = 'Event Pass',
  onSuccess,
  onFailure,
  onDismiss,
}) => {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !window.Razorpay) {
    throw new Error('Razorpay SDK could not be loaded. Please check your internet connection.');
  }

  return new Promise((resolve, reject) => {
    try {
      console.log('[Razorpay SDK] Opening checkout with Order ID:', orderData.razorpayOrderId, 'Key:', orderData.razorpayKeyId, 'Amount (paise):', Math.round(orderData.amount * 100));

      const options = {
        key: orderData.razorpayKeyId,
        amount: Math.round(orderData.amount * 100), // in paise
        currency: orderData.currency || 'INR',
        name: 'EventHub Tickets',
        description: `Admission passes for ${eventName}`,
        image: 'https://cdn-icons-png.flaticon.com/512/3884/3884851.png',
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.mobile || '',
        },
        notes: {
          bookingId: orderData.receiptId || '',
          platform: 'EventHub Ticketing System',
        },
        theme: {
          color: '#6366f1',
        },
        modal: {
          ondismiss: () => {
            console.log('[Razorpay SDK] Checkout modal dismissed by user');
            if (onDismiss) onDismiss();
            resolve({ dismissed: true });
          },
          escape: true,
        },
        handler: (response) => {
          console.log('[Razorpay SDK] Payment succeeded:', response);
          if (onSuccess) {
            onSuccess(response);
          }
          resolve(response);
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on('payment.failed', (response) => {
        console.error('[Razorpay SDK] Payment failed:', response.error);
        const errorMsg = response.error?.description || response.error?.reason || 'Payment failed';
        if (onFailure) {
          onFailure(new Error(errorMsg));
        }
        reject(new Error(errorMsg));
      });

      razorpayInstance.open();
    } catch (err) {
      console.error('[Razorpay SDK] Error creating or opening Razorpay instance:', err);
      if (onFailure) onFailure(err);
      reject(err);
    }
  });
};
