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

      const permissions = Array.isArray(user.permissions) ? user.permissions : [];

      // Check if user has the required permission in their permissions array
      if (permissions.includes(requiredPermission) || permissions.includes("all")) {
        return next();
      }

      return res.status(403).json({ msg: "Access denied: Insufficient permissions" });
    } catch (err) {
      return res.status(500).json({ msg: "Internal server error during permission check" });
    }
  };
};

export const checkAnyPermission = (requiredPermissions) => {
  return (req, res, next) => {
    try {
      const { user } = req;

      if (!user) {
        return res.status(401).json({ msg: "Authentication required" });
      }

      if (user.role === "superadmin") {
        return next();
      }

      const permissions = Array.isArray(user.permissions) ? user.permissions : [];
      if (
        permissions.includes("all") ||
        requiredPermissions.some((permission) => permissions.includes(permission))
      ) {
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

      // Superadmin bypass
      if (user.role === "superadmin") {
        return next();
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
