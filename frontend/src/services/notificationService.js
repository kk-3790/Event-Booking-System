import api from './api';

export const getMyNotifications = () => api.get('/notifications/my');
