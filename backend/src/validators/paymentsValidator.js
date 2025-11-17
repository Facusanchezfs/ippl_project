const Joi = require('joi');

const sendReceiptsSchema = Joi.object({
  body: Joi.object({
    payerName: Joi.string().min(1).optional(),
    payerEmail: Joi.string().email().optional(),
    amountPaid: Joi.number().min(0).optional(),
    currentDebt: Joi.number().min(0).optional(),
    creditBalance: Joi.number().min(0).optional(),
    notes: Joi.string().allow('').optional(),
  }),
});

module.exports = {
  sendReceipts: sendReceiptsSchema,
};

