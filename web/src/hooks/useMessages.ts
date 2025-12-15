import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { MessageDetailResponse, MessageListResponse } from "../api/types";

export const useMessages = (search?: string, to?: string, offset = 0, limit = 20) => {
  return useQuery<MessageListResponse>({
    queryKey: ["messages", { search, to, offset, limit }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search?.trim()) params.set("q", search.trim());
      if (to?.trim()) params.set("to", to.trim());
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      return apiClient(`/messages?${params.toString()}`);
    },
  });
};

export const useMessage = (id: string | null) => {
  return useQuery<MessageDetailResponse>({
    queryKey: ["message", id],
    queryFn: () => apiClient(`/messages/${id}`),
    enabled: !!id,
  });
};

export const useDeleteMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/messages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
};

export const useBatchDeleteMessages = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiClient("/messages/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
};
