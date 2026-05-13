#!/bin/bash

# ============================================================
# TURF BOOKING API - CURL COMMANDS FOR TESTING
# ============================================================
# Use these commands in your terminal to test all API endpoints
# Replace {values} with actual data
# ============================================================

BASE_URL="http://localhost:5000/api"

echo "=== TURF BOOKING API - cURL Test Commands ==="
echo "Base URL: $BASE_URL"
echo ""

# ============================================================
# 1. AUTHENTICATION ENDPOINTS
# ============================================================

echo "========== AUTHENTICATION =========="
echo ""

# Register
echo "1. REGISTER - Create new user"
echo 'curl -X POST "$BASE_URL/auth/register" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d "{\"name\":\"Raj Kumar\",\"email\":\"raj.kumar@example.com\",\"phone\":\"9876543210\",\"password\":\"SecurePass@123\",\"confirmPassword\":\"SecurePass@123\"}"'
echo ""

# Login
echo "2. LOGIN - Get JWT Token"
echo 'curl -X POST "$BASE_URL/auth/login" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d "{\"email\":\"raj.kumar@example.com\",\"password\":\"SecurePass@123\"}"'
echo ""
echo "📌 Save the token from response - you'll need it for other requests"
echo ""

# Get Profile
echo "3. GET PROFILE - Fetch current user"
echo 'curl -X GET "$BASE_URL/auth/profile" \'
echo '  -H "Authorization: Bearer {JWT_TOKEN}"'
echo ""

# Update Password
echo "4. UPDATE PASSWORD"
echo 'curl -X PUT "$BASE_URL/auth/update-password" \'
echo '  -H "Content-Type: application/json" \'
echo '  -H "Authorization: Bearer {JWT_TOKEN}" \'
echo '  -d "{\"oldPassword\":\"SecurePass@123\",\"newPassword\":\"NewSecure@456\",\"confirmPassword\":\"NewSecure@456\"}"'
echo ""

# ============================================================
# 2. TURF ENDPOINTS
# ============================================================

echo ""
echo "========== TURFS =========="
echo ""

# Get All Turfs
echo "5. GET ALL TURFS - List with pagination"
echo 'curl -X GET "$BASE_URL/turfs?page=1&limit=10&city=Mumbai" \'
echo '  -H "Content-Type: application/json"'
echo ""

# Get Single Turf
echo "6. GET TURF BY ID"
echo 'curl -X GET "$BASE_URL/turfs/{turf_id}" \'
echo '  -H "Content-Type: application/json"'
echo ""

# Get Turf Availability
echo "7. GET TURF AVAILABILITY - Check slots for date"
echo 'curl -X GET "$BASE_URL/turfs/{turf_id}/availability?date=2026-05-20" \'
echo '  -H "Content-Type: application/json"'
echo ""

# Create Turf (Multipart - Form Data)
echo "8. CREATE TURF - Add new venue (Admin)"
echo 'curl -X POST "$BASE_URL/turfs" \'
echo '  -H "Authorization: Bearer {JWT_TOKEN}" \'
echo '  -F "name=Elite Sports Arena" \'
echo '  -F "pricePerHour=2000" \'
echo '  -F "peakHourSurcharge=500" \'
echo '  -F "location={\"address\":\"Delhi\",\"city\":\"Delhi\",\"coordinates\":{\"lat\":28.6329,\"lng\":77.1197}}" \'
echo '  -F "sports=[\"Cricket\",\"Football\"]" \'
echo '  -F "amenities=[\"Floodlights\",\"Parking\"]" \'
echo '  -F "logo=@/path/to/logo.jpg"'
echo ""

# ============================================================
# 3. BOOKING ENDPOINTS
# ============================================================

echo ""
echo "========== BOOKINGS =========="
echo ""

# Check Availability
echo "9. CHECK AVAILABILITY - Before booking"
echo 'curl -X GET "$BASE_URL/bookings/check-availability?turfId={turf_id}&date=2026-05-20&startTime=18:00&endTime=19:00" \'
echo '  -H "Content-Type: application/json"'
echo ""

# Create Booking
echo "10. CREATE BOOKING"
echo 'curl -X POST "$BASE_URL/bookings" \'
echo '  -H "Content-Type: application/json" \'
echo '  -H "Authorization: Bearer {JWT_TOKEN}" \'
echo '  -d "{\"turfId\":\"{turf_id}\",\"sport\":\"Cricket\",\"date\":\"2026-05-20\",\"startTime\":\"18:00\",\"endTime\":\"19:00\",\"courts\":[\"Court A\"],\"numberOfPlayers\":11}"'
echo ""

# Get My Bookings
echo "11. GET MY BOOKINGS"
echo 'curl -X GET "$BASE_URL/bookings/my?page=1&limit=10" \'
echo '  -H "Authorization: Bearer {JWT_TOKEN}"'
echo ""

# Get Booking Details
echo "12. GET BOOKING BY ID"
echo 'curl -X GET "$BASE_URL/bookings/{booking_id}" \'
echo '  -H "Authorization: Bearer {JWT_TOKEN}"'
echo ""

# Process Payment
echo "13. PROCESS PAYMENT"
echo 'curl -X POST "$BASE_URL/bookings/{booking_id}/pay" \'
echo '  -H "Content-Type: application/json" \'
echo '  -H "Authorization: Bearer {JWT_TOKEN}" \'
echo '  -d "{\"amount\":1500,\"paymentMethod\":\"UPI\",\"transactionId\":\"TXN123456789\"}"'
echo ""

# Update Booking Status (Admin)
echo "14. UPDATE BOOKING STATUS (Admin Only)"
echo 'curl -X PATCH "$BASE_URL/bookings/{booking_id}/status" \'
echo '  -H "Content-Type: application/json" \'
echo '  -H "Authorization: Bearer {ADMIN_TOKEN}" \'
echo '  -d "{\"status\":\"confirmed\",\"notes\":\"Booking confirmed\"}"'
echo ""

# ============================================================
# 4. TOURNAMENT ENDPOINTS
# ============================================================

echo ""
echo "========== TOURNAMENTS =========="
echo ""

# Get All Tournaments
echo "15. GET ALL TOURNAMENTS"
echo 'curl -X GET "$BASE_URL/tournaments?page=1" \'
echo '  -H "Content-Type: application/json"'
echo ""

# Get Tournament By ID
echo "16. GET TOURNAMENT BY ID"
echo 'curl -X GET "$BASE_URL/tournaments/{tournament_id}" \'
echo '  -H "Content-Type: application/json"'
echo ""

# Create Tournament (Admin)
echo "17. CREATE TOURNAMENT (Admin)"
echo 'curl -X POST "$BASE_URL/tournaments" \'
echo '  -H "Authorization: Bearer {ADMIN_TOKEN}" \'
echo '  -F "name=Delhi Cricket Championship 2026" \'
echo '  -F "sport=Cricket" \'
echo '  -F "location=Delhi" \'
echo '  -F "startDate=2026-06-01" \'
echo '  -F "endDate=2026-06-15" \'
echo '  -F "registrationFee=5000"'
echo ""

# Register for Tournament
echo "18. REGISTER FOR TOURNAMENT"
echo 'curl -X POST "$BASE_URL/tournaments/{tournament_id}/register" \'
echo '  -H "Content-Type: application/json" \'
echo '  -H "Authorization: Bearer {JWT_TOKEN}" \'
echo '  -d "{\"teamName\":\"Elite Strikers\",\"teamSize\":11,\"contactEmail\":\"team@example.com\",\"contactPhone\":\"9876543210\"}"'
echo ""

# ============================================================
# 5. REVIEW ENDPOINTS
# ============================================================

echo ""
echo "========== REVIEWS =========="
echo ""

# Create Review
echo "19. CREATE REVIEW"
echo 'curl -X POST "$BASE_URL/reviews" \'
echo '  -H "Content-Type: application/json" \'
echo '  -H "Authorization: Bearer {JWT_TOKEN}" \'
echo '  -d "{\"turfId\":\"{turf_id}\",\"rating\":5,\"comment\":\"Excellent ground!\",\"categories\":[\"quality\",\"cleanliness\"]}"'
echo ""

# Get Turf Reviews
echo "20. GET TURF REVIEWS"
echo 'curl -X GET "$BASE_URL/reviews/turf/{turf_id}" \'
echo '  -H "Content-Type: application/json"'
echo ""

# ============================================================
# 6. CHAT ENDPOINTS
# ============================================================

echo ""
echo "========== CHAT =========="
echo ""

# Create Conversation
echo "21. CREATE CONVERSATION"
echo 'curl -X POST "$BASE_URL/chat/conversation" \'
echo '  -H "Content-Type: application/json" \'
echo '  -H "Authorization: Bearer {JWT_TOKEN}" \'
echo '  -d "{\"participantId\":\"{user_id}\",\"type\":\"direct\"}"'
echo ""

# Send Message
echo "22. SEND MESSAGE"
echo 'curl -X POST "$BASE_URL/chat/message" \'
echo '  -H "Authorization: Bearer {JWT_TOKEN}" \'
echo '  -F "conversationId={conversation_id}" \'
echo '  -F "content=Hi, I have a question about booking"'
echo ""

# Get Messages
echo "23. GET MESSAGES FROM CONVERSATION"
echo 'curl -X GET "$BASE_URL/chat/messages/{conversation_id}?page=1&limit=20" \'
echo '  -H "Authorization: Bearer {JWT_TOKEN}"'
echo ""

# Get Superadmin
echo "24. GET SUPERADMIN CONTACT"
echo 'curl -X GET "$BASE_URL/chat/superadmin" \'
echo '  -H "Authorization: Bearer {JWT_TOKEN}"'
echo ""

# ============================================================
# 7. MASTER DATA ENDPOINTS
# ============================================================

echo ""
echo "========== MASTER DATA =========="
echo ""

# Get Masters
echo "25. GET MASTER DATA (Sports, Amenities, etc.)"
echo 'curl -X GET "$BASE_URL/masters" \'
echo '  -H "Content-Type: application/json"'
echo ""

# ============================================================
# 8. DASHBOARD ENDPOINTS
# ============================================================

echo ""
echo "========== DASHBOARD & ANALYTICS =========="
echo ""

# Get Public Stats
echo "26. GET PUBLIC STATISTICS"
echo 'curl -X GET "$BASE_URL/dashboard/public-stats" \'
echo '  -H "Content-Type: application/json"'
echo ""

# Get Admin Stats
echo "27. GET ADMIN STATISTICS (Admin Only)"
echo 'curl -X GET "$BASE_URL/dashboard/stats" \'
echo '  -H "Authorization: Bearer {ADMIN_TOKEN}"'
echo ""

# ============================================================
# 9. BILLING ENDPOINTS
# ============================================================

echo ""
echo "========== BILLING =========="
echo ""

# Get Billing Stats
echo "28. GET BILLING STATISTICS (Admin Only)"
echo 'curl -X GET "$BASE_URL/billing/stats" \'
echo '  -H "Authorization: Bearer {ADMIN_TOKEN}"'
echo ""

# ============================================================
# 10. SETTINGS ENDPOINTS
# ============================================================

echo ""
echo "========== SETTINGS =========="
echo ""

# Get Settings
echo "29. GET SYSTEM SETTINGS"
echo 'curl -X GET "$BASE_URL/settings" \'
echo '  -H "Content-Type: application/json"'
echo ""

# ============================================================
# 11. VENUE LEAD ENDPOINTS
# ============================================================

echo ""
echo "========== VENUE LEADS =========="
echo ""

# Create Venue Lead (Public)
echo "30. SUBMIT VENUE LEAD (Public Form)"
echo 'curl -X POST "$BASE_URL/venue-leads" \'
echo '  -F "venueName=Central Sports Ground" \'
echo '  -F "ownerName=Akshay Patel" \'
echo '  -F "email=akshay@centralsports.com" \'
echo '  -F "phone=9876543210" \'
echo '  -F "city=Pune" \'
echo '  -F "address=Baner Road, Pune" \'
echo '  -F "sports=Cricket, Football, Badminton"'
echo ""

# Get Venue Leads (Admin)
echo "31. GET VENUE LEADS (Admin Only)"
echo 'curl -X GET "$BASE_URL/venue-leads" \'
echo '  -H "Authorization: Bearer {ADMIN_TOKEN}"'
echo ""

# Update Venue Lead Status
echo "32. UPDATE VENUE LEAD STATUS (Admin Only)"
echo 'curl -X PATCH "$BASE_URL/venue-leads/{venue_lead_id}/status" \'
echo '  -H "Content-Type: application/json" \'
echo '  -H "Authorization: Bearer {ADMIN_TOKEN}" \'
echo '  -d "{\"status\":\"approved\",\"notes\":\"Venue meets requirements\"}"'
echo ""

# ============================================================
# TIPS FOR TESTING
# ============================================================

echo ""
echo "========== TESTING TIPS =========="
echo ""
echo "1. Save JWT Token to Variable:"
echo "   TOKEN=\$(curl ... | jq -r '.token')"
echo ""
echo "2. Use Token in Subsequent Requests:"
echo "   curl -H \"Authorization: Bearer \$TOKEN\" ..."
echo ""
echo "3. Pretty Print JSON Response:"
echo "   curl ... | jq"
echo ""
echo "4. Save Response to File:"
echo "   curl ... > response.json"
echo ""
echo "5. Test File Upload:"
echo "   -F \"file=@/path/to/file.jpg\""
echo ""
echo "6. For Form Data (not JSON):"
echo "   -F \"field=value\""
echo ""

# ============================================================
# COMMON VARIABLES TO REPLACE
# ============================================================

echo ""
echo "========== REPLACE THESE VARIABLES =========="
echo ""
echo "{JWT_TOKEN}       - From login/register response"
echo "{turf_id}         - MongoDB ID of turf"
echo "{booking_id}      - MongoDB ID of booking"
echo "{tournament_id}   - MongoDB ID of tournament"
echo "{user_id}         - MongoDB ID of user"
echo "{conversation_id} - MongoDB ID of conversation"
echo "{venue_lead_id}   - MongoDB ID of venue lead"
echo "{ADMIN_TOKEN}     - JWT token of admin user"
echo ""

echo "✅ All commands ready for testing!"
