const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const createApp = require('./app');

const PORT = process.env.PORT || 3000;
const httpServer = http.createServer();

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
});

// Socket.IO connection handlers
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Customer joins booking room for real-time updates
  socket.on('join_booking_room', ({ bookingId }) => {
    socket.join(`booking_${bookingId}`);
    console.log(`👤 Customer joined: booking_${bookingId}`);
  });

  // Customer leaves booking room (cancelled / logged out)
  socket.on('leave_booking_room', ({ bookingId }) => {
    socket.leave(`booking_${bookingId}`);
    console.log(`👤 Customer left: booking_${bookingId}`);
  });

  // Driver joins their personal room to receive assignments
  socket.on('join_driver_room', ({ driverId }) => {
    socket.join(`driver_${driverId}`);
    console.log(`🚗 Driver joined: driver_${driverId}`);
  });

  // Admin joins admin room for dashboard updates
  socket.on('join_admin_room', () => {
    socket.join('admin_room');
    console.log(`👑 Admin joined admin_room`);
  });

  // Driver broadcasts real-time GPS location
  socket.on('driver_location', ({ driverId, lat, lng, bookingId }) => {
    if (bookingId) {
      socket.to(`booking_${bookingId}`).emit('driver_location_update', { driverId, lat, lng, bookingId });
    }
    socket.to('admin_room').emit('driver_location_update', { driverId, lat, lng });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// Attach Express to HTTP server
const app = createApp(io);
httpServer.on('request', app);

httpServer.listen(PORT, () => {
  console.log(`\n🚀 AIRRIDE API running on port ${PORT}`);
  console.log(`📡 Socket.IO ready on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`❤️  Health: http://localhost:${PORT}/health\n`);
});

module.exports = { io };
