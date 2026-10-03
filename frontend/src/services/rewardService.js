import api from './api';

export const getEventDraw = (eventId) => api.get(`/rewards/event/${eventId}`);
export const applyPromoCode = (data) => api.post('/rewards/apply-promo', data);
export const createOrUpdateDraw = (eventId, data) => api.post(`/rewards/event/${eventId}`, data);
export const executeDraw = (drawId) => api.post(`/rewards/draw/${drawId}`);
export const getMyVouchers = () => api.get('/rewards/my-vouchers');

