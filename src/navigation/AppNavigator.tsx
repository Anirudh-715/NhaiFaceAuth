import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { EnrollScreen } from '../screens/EnrollScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { Colors } from '../theme';

export type RootStackParamList = {
  Home: undefined;
  Enroll: undefined;
  Auth: undefined;
  History: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  return (
    <NavigationContainer theme={{
      ...DefaultTheme,
      dark: false,
      colors: {
        ...DefaultTheme.colors,
        primary: Colors.saffron,
        background: Colors.bgPrimary,
        card: Colors.bgPrimary,
        text: Colors.textPrimary,
        border: Colors.cardBorder,
        notification: Colors.saffron,
      },
    }}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.navy,
          },
          headerTintColor: Colors.textOnDark,
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          contentStyle: {
            backgroundColor: Colors.bgPrimary,
          },
          animation: 'ios_from_right',
          animationDuration: 350,
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Enroll" 
          component={EnrollScreen} 
          options={{ title: 'Enroll New Face' }} 
        />
        <Stack.Screen 
          name="Auth" 
          component={AuthScreen} 
          options={{ title: 'Authenticate', headerTransparent: true, headerTintColor: Colors.textOnDark }} 
        />
        <Stack.Screen 
          name="History" 
          component={HistoryScreen} 
          options={{ title: 'Auth History' }} 
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen} 
          options={{ title: 'Settings' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
