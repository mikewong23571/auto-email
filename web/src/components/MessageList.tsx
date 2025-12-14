import { useState } from "react";
import { useMessages, useDeleteMessage } from "../hooks/useMessages";
import { MessageDetail } from "./MessageDetail";
import type { Message } from "../api/types";

export const MessageList = () => {
	const [search, setSearch] = useState("");
	const [toAddr, setToAddr] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const { data: response, isLoading, error, isFetching } = useMessages(
		search,
		toAddr,
	);
	const deleteMutation = useDeleteMessage();

	const messages = response?.data || [];

	const handleDelete = async (e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		if (confirm("Delete this message?")) {
			deleteMutation.mutate(id);
		}
	};

	if (error) return <div className="text-red-500">Error loading messages</div>;

		return (
			<div className="space-y-4">
				<div className="flex flex-col gap-3 md:flex-row">
					<input
						type="email"
						placeholder="Recipient email (required unless searching)"
						className="flex-1 p-2 border rounded"
						value={toAddr}
						onChange={(e) => setToAddr(e.target.value)}
					/>
					<input
						type="text"
						placeholder="Search messages..."
						className="flex-1 p-2 border rounded"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>

				{!search.trim() && !toAddr.trim() ? (
					<div className="text-sm text-gray-500">
						Enter a recipient email or a search keyword to load messages.
					</div>
				) : isLoading || isFetching ? (
					<div>Loading...</div>
				) : (
				<div className="bg-white shadow rounded-lg overflow-hidden">
					<ul className="divide-y divide-gray-200">
						{messages.map((msg: Message) => (
							<li
								key={msg.id}
								className="p-0 hover:bg-gray-50 transition-colors"
							>
								<button
									type="button"
									onClick={() => setSelectedId(msg.id)}
									className="w-full text-left p-4 bg-transparent border-0 cursor-pointer"
								>
									<div className="flex justify-between items-start">
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-blue-600 truncate">
												{msg.from_addr}
											</p>
											<p className="text-sm font-bold text-gray-900 truncate">
												{msg.subject || "(No Subject)"}
											</p>
											<p className="text-sm text-gray-500 truncate">
												{msg.preview || "No preview"}
											</p>
										</div>
										<div className="ml-4 flex flex-col items-end whitespace-nowrap">
											<span className="text-xs text-gray-400">
												{new Date(msg.received_at * 1000).toLocaleDateString()}
											</span>
											<button
												type="button"
												onClick={(e) => handleDelete(e, msg.id)}
												className="mt-2 text-xs text-red-400 hover:text-red-600 px-2 py-1"
											>
												Delete
											</button>
										</div>
									</div>
								</button>
							</li>
						))}
						{messages.length === 0 && (
							<li className="p-8 text-center text-gray-500">
								No messages found
							</li>
						)}
					</ul>
				</div>
			)}

			{selectedId && (
				<MessageDetail id={selectedId} onClose={() => setSelectedId(null)} />
			)}
		</div>
	);
};
