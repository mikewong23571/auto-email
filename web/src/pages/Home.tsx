import { useState } from "react";
import { MessageList } from "../components/MessageList";
import { setToken, getToken } from "../api/client";

export const Home = () => {
	const [token, setUiToken] = useState(getToken() || "");
	const [isAuthed, setIsAuthed] = useState(!!getToken());

	const handleSaveToken = () => {
		setToken(token);
		setIsAuthed(true);
		window.location.reload(); // Simple reload to refresh queries
	};

	if (!isAuthed) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-100">
				<div className="bg-white p-8 rounded shadow-md w-96">
					<h1 className="text-2xl font-bold mb-4">Login</h1>
					<input
						type="password"
						value={token}
						onChange={(e) => setUiToken(e.target.value)}
						placeholder="Enter API Token"
						className="w-full p-2 border rounded mb-4"
					/>
					<button
						type="button"
						onClick={handleSaveToken}
						className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
					>
						Save Token
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-100 p-4 md:p-8">
			<div className="max-w-4xl mx-auto">
				<div className="flex justify-between items-center mb-6">
					<h1 className="text-3xl font-bold text-gray-800">
						Cloudflare Mail Cleaner
					</h1>
					<button
						type="button"
						onClick={() => {
							setToken("");
							setIsAuthed(false);
						}}
						className="text-sm text-gray-500 hover:text-gray-700"
					>
						Logout
					</button>
				</div>
				<MessageList />
			</div>
		</div>
	);
};
