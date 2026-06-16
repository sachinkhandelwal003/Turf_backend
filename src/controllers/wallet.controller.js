import Wallet from '../models/wallet.model.js';
import WalletTransaction from '../models/walletTransaction.model.js';
import Booking from '../models/booking.model.js';

// Helper function to get or create a wallet for an admin
export const getOrCreateWallet = async (adminId) => {
  let wallet = await Wallet.findOne({ admin: adminId });
  if (!wallet) {
    wallet = await Wallet.create({ admin: adminId, balance: 0, totalEarnings: 0 });
  }
  return wallet;
};

// @desc    Get admin wallet details
// @route   GET /api/wallet
// @access  Private (Admin/Superadmin)
export const getWalletDetails = async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.user._id);
    res.json({
      success: true,
      data: wallet
    });
  } catch (err) {
    console.error('Get Wallet Error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get wallet transactions for admin
// @route   GET /api/wallet/transactions
// @access  Private (Admin/Superadmin)
export const getWalletTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const transactions = await WalletTransaction.find({ admin: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('booking', 'bookingId date');

    const totalTransactions = await WalletTransaction.countDocuments({ admin: req.user._id });

    res.json({
      success: true,
      data: {
        transactions,
        total: totalTransactions,
        pages: Math.ceil(totalTransactions / limit),
        currentPage: page
      }
    });
  } catch (err) {
    console.error('Get Wallet Transactions Error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Helper function to credit admin wallet (80% of booking amount)
export const creditAdminWallet = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId).populate('turf', 'owner');
    if (!booking || !booking.turf?.owner) {
      console.log('Booking or turf owner not found for wallet credit');
      return;
    }

    const adminId = booking.turf.owner;
    const amount = parseFloat(booking.totalAmount || booking.price || 0);
    const adminShare = amount * 0.8; // 80% share

    if (adminShare <= 0) {
      console.log('No amount to credit for wallet');
      return;
    }

    const wallet = await getOrCreateWallet(adminId);
    
    // Update wallet
    wallet.balance += adminShare;
    wallet.totalEarnings += adminShare;
    await wallet.save();

    // Create transaction record
    await WalletTransaction.create({
      wallet: wallet._id,
      admin: adminId,
      type: 'credit',
      amount: adminShare,
      description: `Earnings from booking #${booking.bookingId}`,
      booking: bookingId,
    });

    console.log(`Wallet credited: ₹${adminShare} to admin ${adminId}`);
  } catch (err) {
    console.error('Credit Wallet Error:', err);
  }
};
