import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as usersApi from './api';
import { usersKeys } from './keys';
import { useToast } from '../../providers/ToastProvider';
import type { CreateUserFormValues } from './schema';

export function useUsers(filters: usersApi.ListUsersParams = {}) {
  return useQuery({
    queryKey: usersKeys.list(filters as Record<string, unknown>),
    queryFn: () => usersApi.listUsers(filters),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: (values: CreateUserFormValues) => usersApi.createUser(values),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      addToast({
        type: 'success',
        title: 'User Created',
        message: `Account for ${data.user.username} created successfully`,
      });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: { phone?: string; isActive?: boolean } }) =>
      usersApi.updateUser(userId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(data.id) });
      addToast({
        type: 'success',
        title: 'User Updated',
        message: `User ${data.username} updated successfully`,
      });
    },
  });
}

export function useResetPassword() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: (userId: string) => usersApi.resetPassword(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      addToast({
        type: 'success',
        title: 'Password Reset',
        message: 'Temporary password generated successfully',
      });
    },
  });
}
