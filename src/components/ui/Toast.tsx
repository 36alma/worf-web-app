/** Toast helper facade for success/error/info calendar notifications. */
'use client';

import toast from 'react-hot-toast';

export const Toast = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  info: (message: string) => toast(message)
};

export default Toast;
