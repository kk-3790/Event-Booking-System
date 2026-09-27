const mongoose = require('mongoose');

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI;
  const localFallbackUri = 'mongodb://127.0.0.1:27017/event-booking';

  try {
    console.log('Connecting to primary MongoDB (Atlas)...');
    await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to MongoDB Atlas successfully');
  } catch (err) {
    console.warn('⚠️  Could not connect to MongoDB Atlas cluster:', err.message);
    console.warn('👉 Note: To allow connection to Atlas from this device, please add IP 43.249.234.163 or 0.0.0.0/0 in MongoDB Atlas > Network Access.');
    console.log('🔄 Engaging automatic fallback to local MongoDB instance...');
    try {
      await mongoose.connect(localFallbackUri);
      console.log('✅ Connected to local MongoDB fallback database successfully');
    } catch (localErr) {
      console.error('❌ Fatal: Could not connect to primary or fallback MongoDB:', localErr.message);
      process.exit(1);
    }
  }
};

module.exports = connectDB;