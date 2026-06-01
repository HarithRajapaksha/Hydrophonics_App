// App.js — Premium Fluid Bubble Navigation Bar
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import HomePage from './components/HomePage';
import Statics  from './components/Statics';
import Setting, { DEFAULT_THRESHOLDS } from './components/Setting';
import { registerNotificationListener, unregisterNotificationListener } from './components/Notifications';

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  {
    key: 'home',
    label: 'Home',
    iconActive: 'leaf',
    iconInactive: 'leaf-outline',
    activeColor: '#10B981', // Emerald green representing plants/nature
    activeBg: '#E6F7ED',    // Rich pastel green
    labelWidth: 44,
  },
  {
    key: 'statistics',
    label: 'Stats',
    iconActive: 'stats-chart',
    iconInactive: 'stats-chart-outline',
    activeColor: '#3B82F6', // Electric blue representing data flows
    activeBg: '#EEF2F6',    // Rich pastel blue
    labelWidth: 40,
  },
  {
    key: 'settings',
    label: 'Settings',
    iconActive: 'settings',
    iconInactive: 'settings-outline',
    activeColor: '#8B5CF6', // Indigo/purple representing system configs
    activeBg: '#F5F3FF',    // Rich pastel purple
    labelWidth: 58,
  },
];

// ─── Single Fluid Tab Item ────────────────────────────────────────────────────
const TabItem = ({ tab, isActive, onPress }) => {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const activeAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(activeAnim, {
      toValue: isActive ? 1 : 0,
      friction: 9,
      tension: 65,
      useNativeDriver: false, // Animating layout width, padding, colors
    }).start();
  }, [isActive]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 150,
      useNativeDriver: true,
    }).start();
  };

  // Color & layout interpolations
  const pillBgColor = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0)', tab.activeBg],
  });

  // Smooth cross-fade opacities (allows full hardware acceleration!)
  const activeOpacity = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const inactiveOpacity = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const labelWidth = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tab.labelWidth],
  });

  const labelOpacity = activeAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0, 1],
  });

  const labelMargin = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
  });

  const labelTranslateX = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 0],
  });

  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        <Animated.View style={[
          styles.tabPill,
          {
            backgroundColor: pillBgColor,
          },
        ]}>
          {/* Animated Vector Icon Crossfade */}
          <View style={styles.iconWrapper}>
            {/* Inactive Icon (Outline) */}
            <Animated.View style={{ opacity: inactiveOpacity, position: 'absolute' }}>
              <Ionicons 
                name={tab.iconInactive} 
                size={22} 
                color="#94A3B8"
              />
            </Animated.View>
            {/* Active Icon (Filled) */}
            <Animated.View style={{ opacity: activeOpacity }}>
              <Ionicons 
                name={tab.iconActive} 
                size={22} 
                color={tab.activeColor}
              />
            </Animated.View>
          </View>

          {/* Animated expanding Text label container */}
          <Animated.View style={{
            width: labelWidth,
            opacity: labelOpacity,
            marginLeft: labelMargin,
            overflow: 'hidden',
            justifyContent: 'center',
          }}>
            <Animated.Text 
              style={[
                styles.tabLabel, 
                { 
                  color: tab.activeColor,
                  transform: [{ translateX: labelTranslateX }],
                }
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Animated.Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Bottom Navigation Bar ────────────────────────────────────────────────────
const BottomTabBar = ({ activeTab, onTabPress }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.tabBarOuter}>
      <View style={[
        styles.tabBarContainer,
        { marginBottom: Math.max(insets.bottom, 16) }
      ]}>
        {/* Row of tabs */}
        <View style={styles.tabBarInner}>
          {TABS.map((tab) => (
            <TabItem
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              onPress={() => onTabPress(tab.key)}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

// ─── Inner app ────────────────────────────────────────────────────────────────
const AppInner = () => {
  const insets = useSafeAreaInsets();
  const [activeTab,     setActiveTab]     = useState('home');
  const [thresholds,    setThresholds]    = useState(DEFAULT_THRESHOLDS);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  // Global In-App Notification Banner States
  const [notification, setNotification] = useState(null);
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const timeoutRef = useRef(null);

  const showGlobalNotification = (notif) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setNotification(notif);

    // Slide banner down below status bar
    Animated.spring(slideAnim, {
      toValue: 12,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();

    // Automatically slide back up after 4.5 seconds
    timeoutRef.current = setTimeout(() => {
      dismissNotification();
    }, 4500);
  };

  const dismissNotification = () => {
    Animated.timing(slideAnim, {
      toValue: -150,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setNotification(null);
    });
  };

  useEffect(() => {
    registerNotificationListener((notif) => {
      showGlobalNotification(notif);
    });
    return () => {
      unregisterNotificationListener();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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

      {/* Floating fluid tab bar */}
      <BottomTabBar activeTab={activeTab} onTabPress={setActiveTab} />

      {/* Premium In-App Notification Banner Overlay */}
      {notification && (
        <Animated.View style={[
          styles.notifBannerContainer,
          {
            transform: [{ translateY: slideAnim }],
            top: insets.top || 12,
          }
        ]}>
          <TouchableOpacity 
            style={styles.notifBannerInner}
            onPress={dismissNotification}
            activeOpacity={0.9}
          >
            <View style={styles.notifIconBadge}>
              <Ionicons name="notifications-outline" size={22} color="#E74C3C" />
            </View>
            <View style={{ flex: 1, paddingRight: 4 }}>
              <Text style={styles.notifTitle} numberOfLines={1}>{notification.title}</Text>
              <Text style={styles.notifBody} numberOfLines={2}>{notification.body}</Text>
            </View>
            <TouchableOpacity style={styles.notifCloseBtn} onPress={dismissNotification}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
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

  /* ── Floating bar outer wrapper ────────────── */
  tabBarOuter: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: '#F0F4F8', // Blends with root background to float card cleanly
  },

  /* ── The card-like floating bar ────────────── */
  tabBarContainer: {
    backgroundColor:   'rgba(255, 255, 255, 0.96)',
    borderRadius:      32,
    overflow:          'hidden',
    position:         'relative',

    // High fidelity premium drop shadow
    shadowColor:       '#0F172A',
    shadowOffset:      { width: 0, height: 8 },
    shadowOpacity:     0.12,
    shadowRadius:      16,
    elevation:         10,

    // Micro thin translucent border (Glassmorphic)
    borderWidth:       1,
    borderColor:       'rgba(255, 255, 255, 0.8)',
  },

  /* ── Row of tabs ───────────────────────────── */
  tabBarInner: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-around',
    paddingVertical:   10,
    paddingHorizontal: 12,
  },

  /* ── Individual tab ────────────────────────── */
  tabItem: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
  },

  /* ── Animated pill container ───────────────── */
  tabPill: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    height:            48,
    borderRadius:      24,
    paddingHorizontal: 16,
  },

  iconWrapper: {
    width:             24,
    height:            24,
    alignItems:        'center',
    justifyContent:    'center',
  },

  tabLabel: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: 0.2,
  },

  /* ── Custom In-App Notification Banner Styles ── */
  notifBannerContainer: {
    position:          'absolute',
    left:              16,
    right:             16,
    zIndex:            9999,
    elevation:         25,
  },

  notifBannerInner: {
    backgroundColor:   '#FFFFFF',
    borderRadius:      16,
    flexDirection:     'row',
    alignItems:        'center',
    padding:           12,
    borderWidth:       1.5,
    borderColor:       'rgba(231, 76, 60, 0.25)', // Soft red outline for warnings

    // Drop shadow
    shadowColor:       '#000000',
    shadowOffset:      { width: 0, height: 6 },
    shadowOpacity:     0.18,
    shadowRadius:      12,
    elevation:         15,
  },

  notifIconBadge: {
    width:             38,
    height:            38,
    borderRadius:      19,
    backgroundColor:   '#FDF2F2', // Pastel red background
    alignItems:        'center',
    justifyContent:    'center',
    marginRight:       12,
  },

  notifTitle: {
    fontSize:          13,
    fontWeight:        '800',
    color:             '#1E293B',
    marginBottom:      1,
  },

  notifBody: {
    fontSize:          11,
    color:             '#475569',
    lineHeight:        15,
  },

  notifCloseBtn: {
    marginLeft:        4,
    alignSelf:         'center',
    padding:           2,
  },
});