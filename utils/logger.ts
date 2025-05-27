export interface LogEntry {
	timestamp: Date;
	level: "log" | "error" | "warn" | "info" | "debug";
	message: string;
	data?: any;
}

class Logger {
	private logs: LogEntry[] = [];
	private maxLogs = 1000; // Keep last 1000 logs
	private originalConsole: {
		log: typeof console.log;
		error: typeof console.error;
		warn: typeof console.warn;
		info: typeof console.info;
		debug: typeof console.debug;
	};

	constructor() {
		// Store original console methods
		this.originalConsole = {
			log: console.log.bind(console),
			error: console.error.bind(console),
			warn: console.warn.bind(console),
			info: console.info.bind(console),
			debug: console.debug.bind(console),
		};

		// Override console methods to capture logs
		this.interceptConsole();
	}

	private interceptConsole() {
		console.log = (...args: any[]) => {
			this.addLog(
				"log",
				this.formatMessage(args),
				args.length > 1 ? args.slice(1) : undefined
			);
			this.originalConsole.log(...args);
		};

		console.error = (...args: any[]) => {
			this.addLog(
				"error",
				this.formatMessage(args),
				args.length > 1 ? args.slice(1) : undefined
			);
			this.originalConsole.error(...args);
		};

		console.warn = (...args: any[]) => {
			this.addLog(
				"warn",
				this.formatMessage(args),
				args.length > 1 ? args.slice(1) : undefined
			);
			this.originalConsole.warn(...args);
		};

		console.info = (...args: any[]) => {
			this.addLog(
				"info",
				this.formatMessage(args),
				args.length > 1 ? args.slice(1) : undefined
			);
			this.originalConsole.info(...args);
		};

		console.debug = (...args: any[]) => {
			this.addLog(
				"debug",
				this.formatMessage(args),
				args.length > 1 ? args.slice(1) : undefined
			);
			this.originalConsole.debug(...args);
		};
	}

	private formatMessage(args: any[]): string {
		return args
			.map((arg) => {
				if (typeof arg === "string") {
					return arg;
				} else if (typeof arg === "object") {
					try {
						return JSON.stringify(arg, null, 2);
					} catch {
						return String(arg);
					}
				} else {
					return String(arg);
				}
			})
			.join(" ");
	}

	private addLog(level: LogEntry["level"], message: string, data?: any) {
		const logEntry: LogEntry = {
			timestamp: new Date(),
			level,
			message,
			data,
		};

		this.logs.push(logEntry);

		// Keep only the last maxLogs entries
		if (this.logs.length > this.maxLogs) {
			this.logs = this.logs.slice(-this.maxLogs);
		}
	}

	public getLogs(): LogEntry[] {
		return [...this.logs]; // Return a copy
	}

	public getLogsAsText(): string {
		return this.logs
			.map((log) => {
				const timestamp = log.timestamp.toISOString();
				const level = log.level.toUpperCase().padEnd(5);
				let logLine = `[${timestamp}] ${level} ${log.message}`;

				if (log.data) {
					try {
						logLine += "\n" + JSON.stringify(log.data, null, 2);
					} catch {
						logLine += "\n" + String(log.data);
					}
				}

				return logLine;
			})
			.join("\n\n");
	}

	public clearLogs() {
		this.logs = [];
	}

	public getLogsByLevel(level: LogEntry["level"]): LogEntry[] {
		return this.logs.filter((log) => log.level === level);
	}

	public getLogsAfter(timestamp: Date): LogEntry[] {
		return this.logs.filter((log) => log.timestamp > timestamp);
	}

	public getRecentLogs(count: number): LogEntry[] {
		return this.logs.slice(-count);
	}

	// Restore original console methods (for cleanup if needed)
	public restoreConsole() {
		console.log = this.originalConsole.log;
		console.error = this.originalConsole.error;
		console.warn = this.originalConsole.warn;
		console.info = this.originalConsole.info;
		console.debug = this.originalConsole.debug;
	}
}

// Create and export a singleton instance
export const logger = new Logger();

// Export convenience methods
export const getLogs = () => logger.getLogs();
export const getLogsAsText = () => logger.getLogsAsText();
export const clearLogs = () => logger.clearLogs();
export const getLogsByLevel = (level: LogEntry["level"]) =>
	logger.getLogsByLevel(level);
export const getLogsAfter = (timestamp: Date) => logger.getLogsAfter(timestamp);
export const getRecentLogs = (count: number) => logger.getRecentLogs(count);
