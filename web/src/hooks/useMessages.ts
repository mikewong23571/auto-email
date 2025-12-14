import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { MessageListResponse, MessageDetailResponse } from "../api/types";

export const useMessages = (search?: string, to?: string) => {
	return useQuery<MessageListResponse>({
		queryKey: ["messages", { search, to }],
		queryFn: () => {
			const params = new URLSearchParams();
			if (search) params.set("q", search);
			if (to) params.set("to", to);
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
		mutationFn: (id: string) =>
			apiClient(`/messages/${id}`, { method: "DELETE" }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["messages"] });
		},
	});
};
