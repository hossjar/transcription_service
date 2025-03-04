// src/app/hooks/useSSE.js
import { useEffect, useRef } from 'react';

export default function useSSE(onMessage) {
    const eventSourceRef = useRef(null);
    const retryTimeoutRef = useRef(null);
    const isConnectingRef = useRef(false);

    useEffect(() => {
        const API_URL = process.env.NEXT_PUBLIC_API_URL;
        let retryCount = 0;
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 10000;

        function connect() {
            if (isConnectingRef.current) {
                return;
            }

            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            try {
                isConnectingRef.current = true;
                const eventSource = new EventSource(`${API_URL}/sse`, { withCredentials: true });
                eventSourceRef.current = eventSource;

                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        onMessage(data);
                        retryCount = 0;
                    } catch (error) {
                        // Silently handle message parsing errors
                    }
                };

                eventSource.onopen = () => {
                    isConnectingRef.current = false;
                    retryCount = 0;
                };

                eventSource.onerror = () => {
                    // Silently close the connection
                    eventSource.close();
                    isConnectingRef.current = false;

                    // Only retry if we haven't exceeded MAX_RETRIES
                    if (retryCount < MAX_RETRIES) {
                        retryCount++;
                        const delay = RETRY_DELAY * retryCount;
                        
                        if (retryTimeoutRef.current) {
                            clearTimeout(retryTimeoutRef.current);
                        }
                        
                        retryTimeoutRef.current = setTimeout(() => {
                            connect();
                        }, delay);
                    }
                };

            } catch (error) {
                // Silently handle connection errors
                isConnectingRef.current = false;
            }
        }

        // Handle visibility change silently
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                connect();
            }
        };

        // Handle online/offline status silently
        const handleOnline = () => {
            connect();
        };

        const handleOffline = () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };

        // Add event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial connection only if online
        if (navigator.onLine) {
            connect();
        }

        // Cleanup function
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
            
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [onMessage]);

    // Return a function to manually reconnect if needed
    return {
        reconnect: () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
            isConnectingRef.current = false;
            // Will trigger useEffect and reconnect
            window.dispatchEvent(new Event('online'));
        }
    };
}