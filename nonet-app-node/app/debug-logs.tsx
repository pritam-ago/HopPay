import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { debugLogger, DebugLog, LogLevel } from '@/utils/debugLogger';
import { NeoBrutalismColors } from '@/constants/neoBrutalism';

export default function DebugLogsScreen() {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [filter, setFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const loadLogs = async () => {
    setRefreshing(true);
    try {
      const allLogs = await debugLogger.getAllLogs();
      setLogs(allLogs);
      const statistics = await debugLogger.getStats();
      setStats(statistics);
    } catch (error) {
      Alert.alert('Error', 'Failed to load logs');
    }
    setRefreshing(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleExport = async () => {
    try {
      const exported = await debugLogger.exportLogs();
      await Share.share({
        message: exported,
        title: 'MeshT Debug Logs',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to export logs');
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to delete all debug logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await debugLogger.clearLogs();
            loadLogs();
          },
        },
      ]
    );
  };

  const filteredLogs = filter === 'ALL' 
    ? logs 
    : logs.filter(log => log.level === filter);

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'ERROR':
        return '#FF6B6B';
      case 'WARN':
        return '#FFA500';
      case 'TXN':
        return '#4ECDC4';
      case 'NETWORK':
        return '#45B7D1';
      case 'BLE':
        return '#9B59B6';
      default:
        return '#95A5A6';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + '.' + date.getMilliseconds();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Debug Logs</Text>
        {stats && (
          <Text style={styles.subtitle}>
            {stats.total} logs • {filteredLogs.length} shown
          </Text>
        )}
      </View>

      {/* Statistics */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.byLevel.TXN}</Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.byLevel.ERROR}</Text>
            <Text style={styles.statLabel}>Errors</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.byLevel.NETWORK}</Text>
            <Text style={styles.statLabel}>Network</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.byLevel.BLE}</Text>
            <Text style={styles.statLabel}>BLE</Text>
          </View>
        </View>
      )}

      {/* Filter Buttons */}
      <ScrollView
        horizontal
        style={styles.filterContainer}
        showsHorizontalScrollIndicator={false}
      >
        {['ALL', 'ERROR', 'WARN', 'TXN', 'NETWORK', 'BLE', 'INFO'].map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.filterButton,
              filter === level && styles.filterButtonActive,
            ]}
            onPress={() => setFilter(level as LogLevel | 'ALL')}
          >
            <Text
              style={[
                styles.filterButtonText,
                filter === level && styles.filterButtonTextActive,
              ]}
            >
              {level}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Logs List */}
      <ScrollView
        style={styles.logsContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadLogs} />
        }
      >
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No logs available</Text>
            <Text style={styles.emptySubtext}>
              Logs will appear here as you use the app
            </Text>
          </View>
        ) : (
          filteredLogs.reverse().map((log, index) => (
            <View key={`${log.timestamp}-${index}`} style={styles.logItem}>
              <View style={styles.logHeader}>
                <View
                  style={[
                    styles.levelBadge,
                    { backgroundColor: getLevelColor(log.level) },
                  ]}
                >
                  <Text style={styles.levelText}>{log.level}</Text>
                </View>
                <Text style={styles.timeText}>{formatTime(log.timestamp)}</Text>
              </View>
              <Text style={styles.categoryText}>{log.category}</Text>
              <Text style={styles.messageText}>{log.message}</Text>
              {log.data && (
                <View style={styles.dataContainer}>
                  <Text style={styles.dataText} numberOfLines={5}>
                    {log.data}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionButton} onPress={loadLogs}>
          <Text style={styles.actionButtonText}>🔄 Refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.exportButton]}
          onPress={handleExport}
        >
          <Text style={styles.actionButtonText}>📤 Export</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.clearButton]}
          onPress={handleClear}
        >
          <Text style={styles.actionButtonText}>🗑️ Clear</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NeoBrutalismColors.background,
  },
  header: {
    padding: 20,
    borderBottomWidth: 3,
    borderBottomColor: NeoBrutalismColors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: NeoBrutalismColors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: NeoBrutalismColors.textSecondary,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-around',
    borderBottomWidth: 2,
    borderBottomColor: NeoBrutalismColors.border,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: NeoBrutalismColors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: NeoBrutalismColors.textSecondary,
    marginTop: 4,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: NeoBrutalismColors.border,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: NeoBrutalismColors.border,
    backgroundColor: NeoBrutalismColors.surface,
  },
  filterButtonActive: {
    backgroundColor: NeoBrutalismColors.primary,
    borderColor: NeoBrutalismColors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: NeoBrutalismColors.textPrimary,
  },
  filterButtonTextActive: {
    color: NeoBrutalismColors.textInverse,
  },
  logsContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: NeoBrutalismColors.textPrimary,
  },
  emptySubtext: {
    fontSize: 14,
    color: NeoBrutalismColors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  logItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: NeoBrutalismColors.border,
    backgroundColor: NeoBrutalismColors.surface,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: NeoBrutalismColors.textInverse,
  },
  timeText: {
    fontSize: 12,
    color: NeoBrutalismColors.textSecondary,
    fontFamily: 'monospace',
  },
  categoryText: {
    fontSize: 12,
    color: NeoBrutalismColors.textSecondary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: NeoBrutalismColors.textPrimary,
    marginBottom: 8,
  },
  dataContainer: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: NeoBrutalismColors.border,
  },
  dataText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: NeoBrutalismColors.textPrimary,
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 3,
    borderTopColor: NeoBrutalismColors.border,
    backgroundColor: NeoBrutalismColors.surface,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: NeoBrutalismColors.border,
    backgroundColor: NeoBrutalismColors.background,
    alignItems: 'center',
  },
  exportButton: {
    backgroundColor: NeoBrutalismColors.primary,
    borderColor: NeoBrutalismColors.primary,
  },
  clearButton: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: NeoBrutalismColors.textInverse,
  },
});
