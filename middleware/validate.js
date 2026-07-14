/**
 * This automatically handles Zod validation.
 */

/**
 * 
 * @param {*} schema 
 * @returns 400 on error
 */
module.exports = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (err) {
    res.status(400).json({ error: err.errors });
  }
};