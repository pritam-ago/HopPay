/**
 * Enhanced Debug Logger for Production APK
 * 
 * This logger works in production builds and provides:
 * - Persistent log storage in AsyncStorage
 * - Categorized logging (transaction, network, error, info)
 * - Export functionality to share logs
 * - Auto-cleanup of old logs
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONTRACT_CONFIG } from '@/constants/contracts';

const DEBUG_LOGS_KEY = 'meshT_debug_logs';
const MAX_LOGS = 500; // Keep last 500 log entries

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'TXN' | 'NETWORK' | 'BLE';

export interface DebugLog {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

class DebugLogger {
  private logs: DebugLog[] = [];
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = CONTRACT_CONFIG.DEBUG_MODE ?? true;
    this.loadLogs();
  }

  /**
   * Load logs from AsyncStorage
   */
  private async loadLogs() {
    try {
      const stored = await AsyncStorage.getItem(DEBUG_LOGS_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load debug logs:', error);
    }
  }

  /**
   * Save logs to AsyncStorage
   */
  private async saveLogs() {
    try {
      // Keep only the last MAX_LOGS entries
      if (this.logs.length > MAX_LOGS) {
        this.logs = this.logs.slice(-MAX_LOGS);
      }
      await AsyncStorage.setItem(DEBUG_LOGS_KEY, JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save debug logs:', error);
    }
  }

  /**
   * Add a log entry
   */
  private async addLog(level: LogLevel, category: string, message: string, data?: any) {
    if (!this.isEnabled) return;

    const log: DebugLog = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data: data ? JSON.stringify(data, null, 2) : undefined,
    };

    this.logs.push(log);
    
    // Also log to console for immediate visibility
    const prefix = `[${level}][${category}]`;
    const fullMessage = `${prefix} ${message}`;
    
    switch (level) {
      case 'ERROR':
        console.error(fullMessage, data || '');
        break;
      case 'WARN':
        console.warn(fullMessage, data || '');
        break;
      default:
        console.log(fullMessage, data || '');
    }

    // Save asynchronously
    this.saveLogs();
  }

  /**
   * Log transaction-related events
   */
  txn(message: string, data?: any) {
    this.addLog('TXN', 'Transaction', message, data);
  }

  /**
   * Log network/API calls
   */
  network(message: string, data?: any) {
    this.addLog('NETWORK', 'Network', message, data);
  }

  /**
   * Log BLE mesh network events
   */
  ble(message: string, data?: any) {
    this.addLog('BLE', 'Mesh', message, data);
  }

  /**
   * Log general information
   */
  info(message: string, data?: any) {
    this.addLog('INFO', 'General', message, data);
  }

  /**
   * Log warnings
   */
  warn(message: string, data?: any) {
    this.addLog('WARN', 'Warning', message, data);
  }

  /**
   * Log errors
   */
  error(message: string, data?: any) {
    this.addLog('ERROR', 'Error', message, data);
  }

  /**
   * Get all logs
   */
  async getAllLogs(): Promise<DebugLog[]> {
    await this.loadLogs();
    return this.logs;
  }

  /**
   * Get logs filtered by level
   */
  async getLogsByLevel(level: LogLevel): Promise<DebugLog[]> {
    await this.loadLogs();
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get logs from the last N minutes
   */
  async getRecentLogs(minutes: number = 30): Promise<DebugLog[]> {
    await this.loadLogs();
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.logs.filter(log => log.timestamp >= cutoff);
  }

  /**
   * Export logs as formatted string
   */
  async exportLogs(): Promise<string> {
    await this.loadLogs();
    
    if (this.logs.length === 0) {
      return 'No logs available';
    }

    let output = '=== MeshT Debug Logs ===\n\n';
    output += `Generated: ${new Date().toISOString()}\n`;
    output += `Total Logs: ${this.logs.length}\n\n`;
    output += '='.repeat(50) + '\n\n';

    for (const log of this.logs) {
      const date = new Date(log.timestamp).toISOString();
      output += `[${date}] ${log.level} - ${log.category}\n`;
      output += `${log.message}\n`;
      if (log.data) {
        output += `Data: ${log.data}\n`;
      }
      output += '-'.repeat(50) + '\n';
    }

    return output;
  }

  /**
   * Clear all logs
   */
  async clearLogs() {
    this.logs = [];
    await AsyncStorage.removeItem(DEBUG_LOGS_KEY);
    console.log('[DEBUG] All logs cleared');
  }

  /**
   * Get log statistics
   */
  async getStats(): Promise<{
    total: number;
    byLevel: Record<LogLevel, number>;
    oldestLog?: Date;
    newestLog?: Date;
  }> {
    await this.loadLogs();

    const stats = {
      total: this.logs.length,
      byLevel: {
        INFO: 0,
        WARN: 0,
        ERROR: 0,
        TXN: 0,
        NETWORK: 0,
        BLE: 0,
      } as Record<LogLevel, number>,
      oldestLog: this.logs.length > 0 ? new Date(this.logs[0].timestamp) : undefined,
      newestLog: this.logs.length > 0 ? new Date(this.logs[this.logs.length - 1].timestamp) : undefined,
    };

    for (const log of this.logs) {
      stats.byLevel[log.level]++;
    }

    return stats;
  }
}

// Export singleton instance
export const debugLogger = new DebugLogger();

// Convenience exports
export const logTxn = (message: string, data?: any) => debugLogger.txn(message, data);
export const logNetwork = (message: string, data?: any) => debugLogger.network(message, data);
export const logBle = (message: string, data?: any) => debugLogger.ble(message, data);
export const logInfo = (message: string, data?: any) => debugLogger.info(message, data);
export const logWarn = (message: string, data?: any) => debugLogger.warn(message, data);
export const logError = (message: string, data?: any) => debugLogger.error(message, data);
