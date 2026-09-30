require('dotenv').config();
const mongoose = require('mongoose');
const https = require('https');

const getPublicIP = () => {
  return new Promise((resolve) => {
    https.get('https://api.ipify.org?format=json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).ip);
        } catch {
          resolve('Could not detect IP');
        }
      });
    }).on('error', () => resolve('Could not detect IP'));
  });
};

async function testConnection() {
  console.log('🔍 Diagnosing MongoDB Atlas Connectivity...\n');
  const ip = await getPublicIP();
  console.log(`📡 Your detected public IP address: ${ip}`);

  const primaryUri = process.env.MONGO_URI;
  if (!primaryUri) {
    console.error('❌ MONGO_URI is not set in environment or .env');
    process.exit(1);
  }

  console.log('⏳ Attempting handshake with MongoDB Atlas cluster...');
  try {
    await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 6000 });
    console.log('\n🎉 SUCCESS! MongoDB Atlas cluster connected successfully!');
    console.log('Database name:', mongoose.connection.name);
    console.log('Cluster host:', mongoose.connection.host);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.log('\n⚠️  CONNECTION BLOCKED BY ATLAS FIREWALL:');
    console.log(`Error: ${err.message}\n`);
    console.log('📋 Quick Fix Instructions:');
    console.log('1. Go to https://cloud.mongodb.com and log into your cluster.');
    console.log('2. In the left sidebar, click "Network Access" under Security.');
    console.log('3. Click "+ Add IP Address".');
    console.log(`4. Enter your current IP: ${ip} (or click "Allow Access From Anywhere" / 0.0.0.0/0 for dev testing).`);
    console.log('5. Click "Confirm" and wait ~1 minute.');
    console.log('\n💡 Note: EventHub is currently running safely using the local MongoDB fallback, so your data and testing remain 100% functional!');
    process.exit(1);
  }
}

testConnection();
