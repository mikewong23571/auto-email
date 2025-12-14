import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { MessageListResponse, MessageDetailResponse } from "../api/types";

export const useMessages = (search?: string, to?: string) => {
	const enabled = Boolean(search?.trim() || to?.trim());

	return useQuery<MessageListResponse>({
		queryKey: ["messages", { search, to }],
		enabled,
		queryFn: () => {
			const params = new URLSearchParams();
			if (search?.trim()) params.set("q", search.trim());
			if (to?.trim()) params.set("to", to.trim());
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
