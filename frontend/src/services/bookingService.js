import api from './api';

export const bookTicket = (data) => api.post('/bookings', data);
export const getMyBookings = () => api.get('/bookings/my');
export const getBookingById = (id) => api.get(`/bookings/${id}`);
export const cancelBooking = (id) => api.delete(`/bookings/${id}`);
