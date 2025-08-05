import JWT from 'jsonwebtoken';

// This is your new middleware function
const auth = (req, res, next) => {
  // Check for the token in the Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header is missing' });
  }

  const token = authHeader.split(' ')[1]; // Get the token part after "Bearer "

  try {
    // Verify the token
    const decoded = JWT.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    // Attach the userId to the request object
    req.userId = decoded.userId;

    // Call next() to pass control to the next middleware or route handler
    next();
  } catch (error) {
    // If the token is invalid or expired, a JWT error will be thrown
    console.error('JWT verification failed:', error.message);
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
  }
};

export default auth;