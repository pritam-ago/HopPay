import React, { useState } from 'react';
import { Alert, View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBle } from '@/contexts/BleContext';
import { MessageState } from '@/utils/bleUtils';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

const MeshScreen = () => {
  const [message, setMessage] = useState('');

  const {
    isBroadcasting,
    hasInternet,
    masterState,
    broadcastMessage,
    startBroadcasting,
    stopBroadcasting,
    clearAllAndStop,
    getCurrentBroadcastInfo,
    getProgressFor,
  } = useBle();

  const handleStartUserBroadcast = async () => {
    try {
      await broadcastMessage(message);
      setMessage('');
    } catch (err) {
      Alert.alert('Error', (err as Error).message || 'Failed to encode message');
    }
  };

  const handleClearEverythingAndStop = () => {
    if (masterState.size === 0 && !isBroadcasting) return;

    Alert.alert(
      'Clear Everything & Stop',
      'This will clear received messages, clear the broadcast queue, and stop broadcasting. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear all & stop', style: 'destructive', onPress: clearAllAndStop },
      ]
    );
  };

  const renderReceivedMessageCard = (state: MessageState) => {
    const progress = getProgressFor(state);
    let transactionStatus: {
      success?: boolean;
      error?: string;
      transactionHash?: string;
      stage?: string;
      blockNumber?: number;
    } | null = null;
    
    if (state.isAck && state.isComplete && state.fullMessage) {
      try {
        transactionStatus = JSON.parse(state.fullMessage);
      } catch {}
    }
    
    return (
      <View key={`msg-${state.id}`} style={[styles.messageCard, transactionStatus?.success === false && styles.messageCardError, transactionStatus?.success === true && styles.messageCardSuccess]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{state.isAck ? 'Response' : 'Request'}</Text>
          {transactionStatus && (
            <View style={[styles.statusBadge, transactionStatus.success ? styles.badgeSuccess : styles.badgeError]}>
              <Text style={styles.badgeText}>{transactionStatus.success ? '✅ Success' : '❌ Failed'}</Text>
            </View>
          )}
        </View>

        {transactionStatus ? (
          <View style={styles.cardBody}>
            {transactionStatus.success ? (
              <View>
                <Text style={styles.recordText}>
                  <Text style={styles.recordLabel}>Tx Hash: </Text>
                  {transactionStatus.transactionHash ? `${transactionStatus.transactionHash.slice(0, 10)}...${transactionStatus.transactionHash.slice(-8)}` : 'N/A'}
                </Text>
                {transactionStatus.blockNumber && (
                  <Text style={styles.recordText}>
                    <Text style={styles.recordLabel}>Block: </Text>{transactionStatus.blockNumber}
                  </Text>
                )}
              </View>
            ) : (
              <View>
                <Text style={[styles.recordText, { color: '#EF4444' }]}>
                  <Text style={styles.recordLabel}>Error: </Text>{transactionStatus.error || 'Unknown error'}
                </Text>
                {transactionStatus.stage && (
                  <Text style={styles.recordText}>
                    <Text style={styles.recordLabel}>Stage: </Text>{transactionStatus.stage}
                  </Text>
                )}
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.messageText} numberOfLines={3}>
            {state.fullMessage || (state.isComplete ? '(Decoded)' : '(Incomplete)')}
          </Text>
        )}

        <View style={styles.progressContainer}>
          <View style={styles.progressHeaderRow}>
            <Text style={styles.progressLabel}>Chunks: {progress.received}/{progress.total}</Text>
            <Text style={styles.progressLabel}>{progress.percent}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress.percent}%`, backgroundColor: transactionStatus?.success === false ? '#EF4444' : '#10B981' }]} />
          </View>
          <View style={styles.chunkGrid}>
            {Array.from({ length: state.totalChunks }, (_, i) => {
              const idx = i + 1;
              const have = state.chunks.has(idx);
              return (
                <View key={idx} style={[styles.chunkDot, have ? styles.chunkDotHave : styles.chunkDotMissing]}>
                  <Text style={[styles.chunkDotText, have ? styles.chunkDotTextHave : styles.chunkDotTextMissing]}>{idx}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const allMessages = Array.from(masterState.values()).sort((a, b) => b.id - a.id);
  const currentBroadcast = getCurrentBroadcastInfo();

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.headerTitle}>MESH</Text>
        </View>
        <View style={styles.networkStatusTag}>
          <Feather name={hasInternet ? "wifi" : "radio"} size={14} color={hasInternet ? "#10B981" : "#3B82F6"} style={{ marginRight: 6 }} />
          <Text style={[styles.networkStatusText, { color: hasInternet ? '#10B981' : '#3B82F6' }]}>{hasInternet ? 'ONLINE' : 'MESH'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Broadcaster Section */}
        <View style={styles.glassSection}>
          <View style={styles.broadcasterHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.broadcasterSubtitle}>Currently broadcasting:</Text>
              <Text style={styles.broadcasterValue}>
                {isBroadcasting && currentBroadcast.text ? `🔊 ${currentBroadcast.text}` : '— Idle —'}
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.playButton, isBroadcasting && styles.playButtonActive]} 
              onPress={() => {
                if (isBroadcasting) stopBroadcasting();
                else startBroadcasting();
              }}
            >
              <Feather name={isBroadcasting ? "pause" : "play"} size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.messageInput}
            value={message}
            onChangeText={setMessage}
            placeholder="Broadcast a new message..."
            placeholderTextColor="#8A8A8E"
            multiline
          />
          <TouchableOpacity 
            style={[styles.button, !message.trim() && styles.buttonDisabled]} 
            onPress={handleStartUserBroadcast}
            disabled={!message.trim()}
          >
            <Text style={styles.buttonText}>Broadcast Message</Text>
          </TouchableOpacity>
        </View>

        {/* Receiver Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>NETWORK LOGS</Text>
          <TouchableOpacity onPress={handleClearEverythingAndStop} disabled={allMessages.length === 0}>
            <Text style={[styles.clearText, allMessages.length === 0 && { color: '#4B5563' }]}>Clear All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.messagesContainer}>
          {allMessages.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="activity" size={32} color="#4B5563" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>Listening for signals...</Text>
            </View>
          ) : (
            allMessages.map(msg => renderReceivedMessageCard(msg))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0A120D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
  },
  networkStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  networkStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  glassSection: {
    backgroundColor: 'rgba(28, 30, 31, 1)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 24,
  },
  broadcasterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  broadcasterSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  broadcasterValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F3F4F6',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
  },
  messageInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#FFF',
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  clearText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  messagesContainer: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'rgba(28, 30, 31, 0.5)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  messageCard: {
    backgroundColor: 'rgba(28, 30, 31, 0.9)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
  messageCardError: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  messageCardSuccess: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    color: '#F3F4F6',
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  badgeError: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  cardBody: {
    marginBottom: 12,
  },
  recordText: {
    color: '#D1D5DB',
    fontSize: 13,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  recordLabel: {
    color: '#9CA3AF',
    fontWeight: '700',
  },
  messageText: {
    color: '#D1D5DB',
    fontSize: 13,
    marginBottom: 12,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  chunkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chunkDot: {
    minWidth: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  chunkDotHave: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  chunkDotMissing: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  chunkDotText: {
    fontSize: 10,
    fontWeight: '700',
  },
  chunkDotTextHave: { color: '#34D399' },
  chunkDotTextMissing: { color: '#FCD34D' },
});

export default MeshScreen;
