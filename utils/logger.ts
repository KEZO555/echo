import * as FileSystem from "expo-file-system";

interface LogEntry {
	timestamp: string;
	level: "log" | "warn" | "error" | "info";
	message: string;
	data?: any;
}

class Logger {
	private logBuffer: LogEntry[] = [];
	private maxBufferSize = 1000; // Keep last 1000 log entries in memory
	private logFilePath: string;
	private isInitialized = false;
	private originalConsole: {
		log: typeof console.log;
		info: typeof console.info;
		warn: typeof console.warn;
		error: typeof console.error;
	};

	constructor() {
		this.logFilePath = `${FileSystem.documentDirectory}spotify_debug.log`;

		// Store original console methods
		this.originalConsole = {
			log: console.log,
			info: console.info,
			warn: console.warn,
			error: console.error,
		};

		this.initialize();
		this.interceptConsole();
	}

	private async initialize() {
		try {
			// Create log file if it doesn't exist
			const fileInfo = await FileSystem.getInfoAsync(this.logFilePath);
			if (!fileInfo.exists) {
				await FileSystem.writeAsStringAsync(this.logFilePath, "");
			}
			this.isInitialized = true;

			// Log initialization using original console to avoid recursion
			this.originalConsole.log("Logger initialized", {
				logFilePath: this.logFilePath,
			});
		} catch (error) {
			this.originalConsole.error("Failed to initialize logger:", error);
		}
	}

	private interceptConsole() {
		// Intercept console.log
		console.log = (...args: any[]) => {
			const message = args
				.map((arg) =>
					typeof arg === "object" ? JSON.stringify(arg) : String(arg)
				)
				.join(" ");

			const entry = this.createLogEntry("log", message);
			this.addToBuffer(entry);
			this.writeToFile(entry);

			// Still call original console.log
			this.originalConsole.log(...args);
		};

		// Intercept console.info
		console.info = (...args: any[]) => {
			const message = args
				.map((arg) =>
					typeof arg === "object" ? JSON.stringify(arg) : String(arg)
				)
				.join(" ");

			const entry = this.createLogEntry("info", message);
			this.addToBuffer(entry);
			this.writeToFile(entry);

			// Still call original console.info
			this.originalConsole.info(...args);
		};

		// Intercept console.warn
		console.warn = (...args: any[]) => {
			const message = args
				.map((arg) =>
					typeof arg === "object" ? JSON.stringify(arg) : String(arg)
				)
				.join(" ");

			const entry = this.createLogEntry("warn", message);
			this.addToBuffer(entry);
			this.writeToFile(entry);

			// Still call original console.warn
			this.originalConsole.warn(...args);
		};

		// Intercept console.error
		console.error = (...args: any[]) => {
			const message = args
				.map((arg) =>
					typeof arg === "object" ? JSON.stringify(arg) : String(arg)
				)
				.join(" ");

			const entry = this.createLogEntry("error", message);
			this.addToBuffer(entry);
			this.writeToFile(entry);

			// Still call original console.error
			this.originalConsole.error(...args);
		};
	}

	private formatLogEntry(entry: LogEntry): string {
		const dataStr = entry.data
			? ` | Data: ${JSON.stringify(entry.data, null, 2)}`
			: "";
		return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${
			entry.message
		}${dataStr}\n`;
	}

	private async writeToFile(entry: LogEntry) {
		if (!this.isInitialized) return;

		try {
			const logLine = this.formatLogEntry(entry);

			// Read existing content and append new line
			let existingContent = "";
			try {
				const fileInfo = await FileSystem.getInfoAsync(
					this.logFilePath
				);
				if (fileInfo.exists) {
					existingContent = await FileSystem.readAsStringAsync(
						this.logFilePath
					);
				}
			} catch (readError) {
				// If we can't read, start with empty content
				existingContent = "";
			}

			await FileSystem.writeAsStringAsync(
				this.logFilePath,
				existingContent + logLine
			);
		} catch (error) {
			// Fallback to original console if file writing fails
			this.originalConsole.error("Failed to write to log file:", error);
		}
	}

	private addToBuffer(entry: LogEntry) {
		this.logBuffer.push(entry);

		// Keep buffer size manageable
		if (this.logBuffer.length > this.maxBufferSize) {
			this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
		}
	}

	private createLogEntry(
		level: LogEntry["level"],
		message: string,
		data?: any
	): LogEntry {
		return {
			timestamp: new Date().toISOString(),
			level,
			message,
			data,
		};
	}

	log(message: string, data?: any) {
		const entry = this.createLogEntry("log", message, data);
		this.addToBuffer(entry);
		this.writeToFile(entry);
		this.originalConsole.log(message, data || "");
	}

	info(message: string, data?: any) {
		const entry = this.createLogEntry("info", message, data);
		this.addToBuffer(entry);
		this.writeToFile(entry);
		this.originalConsole.info(message, data || "");
	}

	warn(message: string, data?: any) {
		const entry = this.createLogEntry("warn", message, data);
		this.addToBuffer(entry);
		this.writeToFile(entry);
		this.originalConsole.warn(message, data || "");
	}

	error(message: string, data?: any) {
		const entry = this.createLogEntry("error", message, data);
		this.addToBuffer(entry);
		this.writeToFile(entry);
		this.originalConsole.error(message, data || "");
	}

	// Get recent logs from buffer
	getRecentLogs(count: number = 50): LogEntry[] {
		return this.logBuffer.slice(-count);
	}

	// Get all logs from buffer
	getLogs(): LogEntry[] {
		return this.logBuffer;
	}

	// Get log file path for sharing
	getLogFilePath(): string {
		return this.logFilePath;
	}

	// Clear log file
	async clearLogFile() {
		try {
			await FileSystem.writeAsStringAsync(this.logFilePath, "");
			this.logBuffer = [];
			this.log("Log file cleared");
		} catch (error) {
			this.error("Failed to clear log file", error);
		}
	}

	// Alias for clearLogFile
	async clearLogs() {
		return this.clearLogFile();
	}

	// Get log file content
	async getLogFileContent(): Promise<string> {
		try {
			const content = await FileSystem.readAsStringAsync(
				this.logFilePath
			);
			return content;
		} catch (error) {
			this.error("Failed to read log file", error);
			return "";
		}
	}

	// Export logs for sharing
	async exportLogs(): Promise<string> {
		try {
			const content = await this.getLogFileContent();
			const exportPath = `${
				FileSystem.documentDirectory
			}spotify_logs_export_${Date.now()}.log`;
			await FileSystem.writeAsStringAsync(exportPath, content);
			this.log("Logs exported", { exportPath });
			return exportPath;
		} catch (error) {
			this.error("Failed to export logs", error);
			throw error;
		}
	}

	// Get file size
	async getLogFileSize(): Promise<number> {
		try {
			const fileInfo = await FileSystem.getInfoAsync(this.logFilePath);
			return fileInfo.exists ? fileInfo.size || 0 : 0;
		} catch (error) {
			this.error("Failed to get log file size", error);
			return 0;
		}
	}

	// Rotate log file if it gets too large (>5MB)
	async rotateLogFileIfNeeded() {
		try {
			const size = await this.getLogFileSize();
			const maxSize = 5 * 1024 * 1024; // 5MB

			if (size > maxSize) {
				const backupPath = `${
					FileSystem.documentDirectory
				}spotify_debug_backup_${Date.now()}.log`;
				await FileSystem.moveAsync({
					from: this.logFilePath,
					to: backupPath,
				});
				await FileSystem.writeAsStringAsync(this.logFilePath, "");
				this.log("Log file rotated", {
					backupPath,
					originalSize: size,
				});
			}
		} catch (error) {
			this.error("Failed to rotate log file", error);
		}
	}

	// Restore original console methods (useful for debugging the logger itself)
	restoreOriginalConsole() {
		console.log = this.originalConsole.log;
		console.info = this.originalConsole.info;
		console.warn = this.originalConsole.warn;
		console.error = this.originalConsole.error;
		this.originalConsole.log("Console methods restored to original");
	}
}

// Create singleton instance
export const logger = new Logger();

// Export convenience functions
export const log = (message: string, data?: any) => logger.log(message, data);
export const logInfo = (message: string, data?: any) =>
	logger.info(message, data);
export const logWarn = (message: string, data?: any) =>
	logger.warn(message, data);
export const logError = (message: string, data?: any) =>
	logger.error(message, data);
