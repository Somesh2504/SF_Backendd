require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors({
  origin: '*'
}));
app.use(bodyParser.json());

// --------------------
// CONFIG
// --------------------
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;


// Load courses from JSON
let allowedCourses = {};
try {
  const coursesData = fs.readFileSync(path.join(__dirname, 'courses.json'), 'utf-8');
  const courses = JSON.parse(coursesData);

  courses.forEach(course => {
    allowedCourses[course.name] = course.price;
  });

  console.log("✅ Courses loaded:", Object.keys(allowedCourses));
} catch (err) {
  console.error("❌ Failed to load courses.json", err);
  process.exit(1);
}

// --------------------
// CREATE ORDER
// --------------------
app.post('/create_order', async (req, res) => {
  console.log("Received order creation request:", req.body);
  try {
    const { course } = req.body;

    // Validate course
    if (!course || !allowedCourses[course]) {
      return res.status(400).json({ error: "Invalid course selected" });
    }

    const amount = allowedCourses[course];

    // Create Razorpay order via API
    console.log("🔑 Razorpay Key ID:", RAZORPAY_KEY_ID);
    const { data } = await axios.post(
      'https://api.razorpay.com/v1/orders',
      {
        amount: amount * 100, // paise
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
        payment_capture: 1
      },
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET
        }
      }
    );

    res.json({
      order_id: data.id,
      amount: data.amount,
      currency: data.currency,
      course
    });

  } catch (err) {
    console.error("Error creating order:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to create Razorpay order" });
  }
});

// --------------------
// VERIFY PAYMENT
// --------------------
app.post('/verify_payment', (req, res) => {
  console.log("Received payment verification request:", req.body);
  try {
    const { order_id, payment_id, signature } = req.body;

    if (!order_id || !payment_id || !signature) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Generate HMAC SHA256 signature
    const generated_signature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(order_id + "|" + payment_id)
      .digest('hex');

    const valid = generated_signature === signature;

    res.json({ valid });

  } catch (err) {
    console.error("Error verifying payment:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Health check route for Render.com
app.get('/', (req, res) => {
  res.send('Server is up and running!');
});

// --------------------
// VERIFY PHONE (from client after Firebase phone verification)
// --------------------
// Accepts: { phone: string, idToken?: string }
// Note: For maximum security verify idToken server-side with Firebase Admin SDK.
app.post('/verify_phone', (req, res) => {
  const { phone, idToken } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone missing' });

  console.log('✅ Verified phone received:', phone);

  // Optional: store in-memory or DB for later reference
  // Example (in-memory, not persistent):
  // if(!global.verifiedPhones) global.verifiedPhones = [];
  // global.verifiedPhones.push(phone);

  // If you want to verify idToken here, add Firebase Admin and verify the token:
  // const admin = require('firebase-admin');
  // admin.auth().verifyIdToken(idToken)
  //   .then(decoded => res.json({ success: true, phone, uid: decoded.uid }))
  //   .catch(err => res.status(401).json({ error: 'Invalid idToken' }));

  res.json({ success: true, phone });
});

// --------------------
// START SERVER
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
