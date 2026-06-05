const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);
  if (err.code === '23505') return res.status(409).json({ success: false, message: 'Resource already exists' });
  if (err.code === '23503') return res.status(400).json({ success: false, message: 'Referenced resource not found' });
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
};

module.exports = { errorHandler, notFound };
