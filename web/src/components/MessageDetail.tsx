import { useMessage } from "../hooks/useMessages";

interface Props {
	id: string;
	onClose: () => void;
}

export const MessageDetail = ({ id, onClose }: Props) => {
	const { data: response, isLoading, error } = useMessage(id);
	const message = response?.data;

	if (isLoading) return <div className="p-4">Loading...</div>;
	if (error)
		return <div className="p-4 text-red-500">Error loading message</div>;
	if (!message) return null;

	const renderBody = () => {
		if (message.body_html) {
			return (
				<div
					className="prose max-w-none"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized in backend
					dangerouslySetInnerHTML={{ __html: message.body_html }}
				/>
			);
		}
		return (
			<pre className="whitespace-pre-wrap font-sans text-gray-800">
				{message.body_text}
			</pre>
		);
	};

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
			<div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
				<div className="p-4 border-b flex justify-between items-center">
					<h2 className="text-xl font-bold truncate pr-4">{message.subject}</h2>
					<button
						type="button"
						onClick={onClose}
						className="text-gray-500 hover:text-gray-700"
					>
						Close
					</button>
				</div>
				<div className="p-4 bg-gray-50 border-b text-sm">
					<p>
						<span className="font-semibold">From:</span> {message.from_addr}
					</p>
					<p>
						<span className="font-semibold">To:</span> {message.to_addr}
					</p>
					<p>
						<span className="font-semibold">Received:</span>{" "}
						{new Date(message.received_at * 1000).toLocaleString()}
					</p>
				</div>
				<div className="flex-1 overflow-auto p-4 bg-white">{renderBody()}</div>
			</div>
		</div>
	);
};
