const express = require('express');
const multer = require('multer');
const { verifyToken } = require('../controllers/authController');
const { sendReceipts } = require('../controllers/paymentController');
const validate = require('../middleware/validate');
const paymentValidators = require('../validators/paymentsValidator');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.RECEIPT_MAX_FILE_SIZE || 10 * 1024 * 1024),
    files: Number(process.env.RECEIPT_MAX_FILES || 10),
  },
});

router.use(verifyToken);

router.post('/send-receipts', upload.array('receipts'), validate(paymentValidators.sendReceipts), sendReceipts);

module.exports = router;

