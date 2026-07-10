import http from 'http';

http.get('http://localhost:5001/api/turfs', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const shivam = parsed.turfs.find(t => t.name === 'Shivam_Test_Venue');
      if (shivam) {
        console.log('Shivam_Test_Venue offer_summary:', shivam.offer_summary);
        console.log('Shivam_Test_Venue offer:', shivam.offer);
      } else {
        console.log('Shivam_Test_Venue not found in response!');
      }
    } catch (e) {
      console.error('Failed to parse:', e.message);
    }
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
