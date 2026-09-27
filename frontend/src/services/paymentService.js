import api from './api';

export const createOrder = (bookingId) => api.post('/payments/create-order', { bookingId });
export const verifyPayment = (data) => api.post('/payments/verify', data);
export const getPaymentStatus = (id) => api.get(`/payments/${id}`);
export const getPaymentByBooking = (bookingId) => api.get(`/payments/booking/${bookingId}`);
