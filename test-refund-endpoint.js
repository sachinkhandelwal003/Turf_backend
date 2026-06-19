
import axios from 'axios';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMTgwMTNiODYzNzUzODA0MTIyZDYzYSIsInJvbGUiOiJhZG1pbiIsInBlcm1pc3Npb25zIjpbInZpZXdfZGFzaGJvYXJkIiwidmlld19ib29raW5ncyIsIm1hbmFnZV9ib29raW5ncyIsInZpZXdfcmV2aWV3cyIsIm1hbmFnZV9yZXZpZXdzIiwidmlld192ZW51ZXMiLCJhZGRfdmVudWUiLCJlZGl0X3ZlbnVlIiwibWFuYWdlX3R1cmZzIiwibWFuYWdlX3RvdXJuYW1lbnRzIiwidmlld19jaGF0IiwibWFuYWdlX2NoYXQiXSwiaWF0IjoxNzgxODU2MTExLCJleHAiOjE3ODI0NjA5MTF9.ezabOMe8lqp3w6TqP2TTDC85K6ePeO_rlmvBpDIHn6w';

async function test() {
  try {
    const res = await axios.get('http://localhost:5001/api/refunds/admin', {
      params: { page: 1, limit: 10 },
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    console.log('SUCCESS:', res.data);
  } catch (err) {
    console.error('ERROR:', err.response?.data || err.message);
    if (err.response?.data?.details) console.error('DETAILS:', err.response.data.details);
  }
}

test();
