import { Router } from 'express';
import {
  register,
  login,
  logout,
  getProfile,
  updatePersonalInfo,
  updateAddress,
  changePassword
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Rotas autenticadas de perfil e conta
router.get('/profile', authenticate, getProfile);
router.put('/profile/personal', authenticate, updatePersonalInfo);
router.put('/profile/address', authenticate, updateAddress);
router.put('/profile/password', authenticate, changePassword);

export default router;
