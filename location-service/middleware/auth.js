const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_par_defaut';

const authMiddleware = (req, res, next) => {
    try {
        // Récupérer le token du header Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Token manquant' });
        }

        // Vérifier le format "Bearer token"
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({ error: 'Format de token invalide' });
        }

        const token = parts[1];

        // Vérifier et décoder le token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Ajouter les informations de l'utilisateur à la requête
        req.user = decoded;
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expiré' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token invalide' });
        }
        return res.status(500).json({ error: 'Erreur d\'authentification' });
    }
};

module.exports = authMiddleware; 