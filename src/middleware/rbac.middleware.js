export const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    try {
      const { user } = req;
      
      if (!user) {
        return res.status(401).json({ msg: "Authentication required" });
      }

      // Superadmin has all permissions
      if (user.role === "superadmin") {
        return next();
      }

      // Check if user has the required permission in their permissions array
      if (user.permissions && Array.isArray(user.permissions) && user.permissions.includes(requiredPermission)) {
        return next();
      }

      return res.status(403).json({ msg: "Access denied: Insufficient permissions" });
    } catch (err) {
      return res.status(500).json({ msg: "Internal server error during permission check" });
    }
  };
};

export const checkRole = (roles) => {
  return (req, res, next) => {
    try {
      const { user } = req;

      if (!user) {
        return res.status(401).json({ msg: "Authentication required" });
      }

      if (roles.includes(user.role)) {
        return next();
      }

      return res.status(403).json({ msg: "Access denied: Unauthorized role" });
    } catch (err) {
      return res.status(500).json({ msg: "Internal server error during role check" });
    }
  };
};
