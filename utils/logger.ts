interface LogEntry {
	timestamp: string;
	level: "LOG" | "WARN" | "ERROR" | "INFO";
	message: string;
	data?: any;
}

class Logger {
	private logs: LogEntry[] = [];
	private maxLogs = 1000; // Keep last 1000 logs

	private addLog(level: LogEntry["level"], message: string, data?: any) {
		const logEntry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			data,
		};

		this.logs.push(logEntry);

		// Keep only the last maxLogs entries
		if (this.logs.length > this.maxLogs) {
			this.logs = this.logs.slice(-this.maxLogs);
		}

		// Also log to console
		const consoleMessage = data ? `${message}` : message;
		switch (level) {
			case "LOG":
				console.log(consoleMessage, data);
				break;
			case "WARN":
				console.warn(consoleMessage, data);
				break;
			case "ERROR":
				console.error(consoleMessage, data);
				break;
			case "INFO":
				console.info(consoleMessage, data);
				break;
		}
	}

	log(message: string, data?: any) {
		this.addLog("LOG", message, data);
	}

	warn(message: string, data?: any) {
		this.addLog("WARN", message, data);
	}

	error(message: string, data?: any) {
		this.addLog("ERROR", message, data);
	}

	info(message: string, data?: any) {
		this.addLog("INFO", message, data);
	}

	getLogs(): LogEntry[] {
		return [...this.logs];
	}

	getLogsByLevel(level: LogEntry["level"]): LogEntry[] {
		return this.logs.filter((log) => log.level === level);
	}

	getLogsAsText(): string {
		return this.logs
			.map((log) => {
				const dataStr = log.data
					? `\n${JSON.stringify(log.data, null, 2)}`
					: "";
				return `[${log.timestamp}] ${log.level.padEnd(5)} ${
					log.message
				}${dataStr}`;
			})
			.join("\n\n");
	}

	clearLogs() {
		this.logs = [];
	}
}

// Create singleton instance
const logger = new Logger();

// Export individual functions for convenience
export const log = (message: string, data?: any) => logger.log(message, data);
export const logWarn = (message: string, data?: any) =>
	logger.warn(message, data);
export const logError = (message: string, data?: any) =>
	logger.error(message, data);
export const logInfo = (message: string, data?: any) =>
	logger.info(message, data);

// Export utility functions
export const getLogs = () => logger.getLogs();
export const getLogsByLevel = (level: "LOG" | "WARN" | "ERROR" | "INFO") =>
	logger.getLogsByLevel(level);
export const getLogsAsText = () => logger.getLogsAsText();
export const clearLogs = () => logger.clearLogs();

// Export the logger instance
export default logger;
