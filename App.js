// App.js — custom tab bar, sits above Android system nav buttons automatically
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import HomePage from './components/HomePage';
import Statics  from './components/Statics';
import Setting, { DEFAULT_THRESHOLDS } from './components/Setting';

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { key: 'home',       label: 'Home',       icon: '🏠' },
  { key: 'statistics', label: 'Statistics', icon: '📊' },
  { key: 'settings',   label: 'Settings',   icon: '⚙️'  },
];

// ─── Custom Bottom Tab Bar ────────────────────────────────────────────────────
const BottomTabBar = ({ activeTab, onTabPress }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onTabPress(tab.key)}
            activeOpacity={0.7}
          >
            {isActive && <View style={styles.tabIndicator} />}
            <View style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}>
              <Text style={styles.tabIcon}>{tab.icon}</Text>
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─── Inner app ────────────────────────────────────────────────────────────────
const AppInner = () => {
  const insets = useSafeAreaInsets();
  const [activeTab,     setActiveTab]     = useState('home');
  const [thresholds,    setThresholds]    = useState(DEFAULT_THRESHOLDS);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomePage thresholds={thresholds} alertsEnabled={alertsEnabled} />;
      case 'statistics':
        return <Statics />;
      case 'settings':
        return (
          <Setting
            thresholds={thresholds}
            onThresholdsChange={setThresholds}
            alertsEnabled={alertsEnabled}
            onAlertsEnabledChange={setAlertsEnabled}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F4F8" />

      {/* Status bar spacer */}
      <View style={{ height: insets.top || StatusBar.currentHeight || 24, backgroundColor: '#F0F4F8' }} />

      {/* Screen content */}
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>

      {/* Tab bar — paddingBottom auto-adjusts above Android nav buttons */}
      <BottomTabBar activeTab={activeTab} onTabPress={setActiveTab} />
    </View>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },

  screenContainer: {
    flex:     1,
    overflow: 'hidden',
  },

  tabBar: {
    flexDirection:     'row',
    backgroundColor:   '#FFFFFF',
    borderTopWidth:    1,
    borderTopColor:    '#ECF0F1',
    paddingTop:        8,
    paddingHorizontal: 10,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: -3 },
    shadowOpacity:     0.08,
    shadowRadius:      8,
    elevation:         12,
  },

  tabItem: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    position:        'relative',
    paddingVertical: 4,
  },

  tabIconWrap: {
    width:           52,
    height:          52,
    borderRadius:    26,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'transparent',
  },

  tabIconWrapActive: {
    backgroundColor: '#45B7D118',
  },

  tabIcon: {
    fontSize: 28,
  },

  tabLabel: {
    fontSize:      12,
    fontWeight:    '600',
    color:         '#95A5A6',
    marginTop:     2,
    letterSpacing: 0.3,
  },

  tabLabelActive: {
    color:      '#45B7D1',
    fontWeight: '800',
  },

  tabIndicator: {
    position:        'absolute',
    top:             0,
    width:           36,
    height:          3,
    borderRadius:    2,
    backgroundColor: '#45B7D1',
  },
});