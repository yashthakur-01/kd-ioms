import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as authApi from './api';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';
import type { LoginFormValues, ChangePasswordFormValues } from './schema';

export function useLogin() {
  const { login: setAuthContext } = useAuth();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: (values: LoginFormValues) => authApi.login(values),
    onSuccess: (data) => {
      setAuthContext(data.accessToken, data.user);
      addToast({
        type: 'success',
        title: 'Welcome Back',
        message: `Signed in as ${data.user.username}`,
      });
    },
  });
}

export function useLogout() {
  const { logout: clearAuthContext } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.clear();
      clearAuthContext();
    },
  });
}

export function useChangePassword() {
  const { user, setUser } = useAuth();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      if (user) {
        setUser({ ...user, mustChangePassword: false });
      }
      addToast({
        type: 'success',
        title: 'Password Changed',
        message: 'Your password has been successfully updated',
      });
    },
  });
}
