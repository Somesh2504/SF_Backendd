// // const express = require('express');
// // const fetch = require('node-fetch');
// // const crypto = require('crypto');
// // const app = express();
// // app.use(express.json());

// // app.post('/create_order', async (req,res)=>{
// //   const { amount } = req.body;
// //   const response = await fetch('https://api.razorpay.com/v1/orders', {
// //     method:'POST',
// //     headers:{'Content-Type':'application/json', 'Authorization':'Basic ' + Buffer.from('rzp_test_RL9XyzhjRRghGr:8S2nF3t718Yxsi7U4De6GEkI').toString('base64')},
// //     body: JSON.stringify({ amount: amount*100, currency:"INR", receipt:"qwsaq1", partial_payment:true, first_payment_min_amount: amount*100 })
// //   });
// //   const data = await response.json();
// //   res.json(data);
// // });

// // app.post('/verify_payment', (req,res)=>{
// //   const { order_id, payment_id, signature } = req.body;
// //   const generated_signature = crypto.createHmac('sha256','8S2nF3t718Yxsi7U4De6GEkI').update(order_id + "|" + payment_id).digest('hex');
// //   res.json({ valid: generated_signature===signature });
// // });
// const express = require('express');
// const fetch = require('node-fetch');
// const crypto = require('crypto');

// const app = express();
// app.use(express.json());

// // Create Razorpay Order
// app.post('/create_order', async (req, res) => {
//   const { amount } = req.body;
//   const response = await fetch('https://api.razorpay.com/v1/orders', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': 'Basic ' + Buffer.from('rzp_test_RL9XyzhjRRghGr:8S2nF3t718Yxsi7U4De6GEkI').toString('base64')
//     },
//     body: JSON.stringify({
//       amount: amount * 100,
//       currency: "INR",
//       receipt: "qwsaq1",
//       partial_payment: true,
//       first_payment_min_amount: amount * 100
//     })
//   });

//   const data = await response.json();
//   res.json(data);
// });

// // Verify Razorpay Payment Signature
// app.post('/verify_payment', (req, res) => {
//   const { order_id, payment_id, signature } = req.body;

//   const generated_signature = crypto.createHmac('sha256', '8S2nF3t718Yxsi7U4De6GEkI')
//     .update(order_id + "|" + payment_id)
//     .digest('hex');

//   res.json({ valid: generated_signature === signature });
// });

// // ✅ Start the server
// app.listen(3000, () => {
//   console.log("Server is running on http://localhost:3000");
// });
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
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

// --------------------
// START SERVER
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
