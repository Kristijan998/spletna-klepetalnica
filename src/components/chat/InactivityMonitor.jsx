import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function InactivityMonitor({ isActive, onLogout, onStayActive }) {
  const [showWarning, setShowWarning] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (!isActive) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const resetTimer = () => {
      setLastActivity(Date.now());
      setShowWarning(false);
      setCountdown(30);
    };

    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    const checkInactivity = setInterval(() => {
      const inactiveTime = Date.now() - lastActivity;
      const inactiveMinutes = Math.floor(inactiveTime / 60000);

      // Show warning after 14 minutes (1 minute before logout)
      if (inactiveMinutes >= 14 && !showWarning) {
        setShowWarning(true);
      }

      // Auto logout after 15 minutes
      if (inactiveMinutes >= 15) {
        onLogout();
      }
    }, 1000);

    return () => clearInterval(checkInactivity);
  }, [lastActivity, showWarning, isActive, onLogout]);

  useEffect(() => {
    if (!showWarning) return;

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [showWarning, onLogout]);

  const handleStayActive = () => {
    setLastActivity(Date.now());
    setShowWarning(false);
    setCountdown(30);
    onStayActive();
  };

  return (
    <Dialog open={showWarning} onOpenChange={(open) => !open && handleStayActive()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Si še tukaj?</DialogTitle>
          <DialogDescription>
            Zaznal sem neaktivnost. Če ne boš odgovoril/a v naslednjih {countdown} sekundah, te bom avtomatsko odjavil/a.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button
            onClick={handleStayActive}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          >
            Ostani prijavljen/a
          </Button>
          <Button
            onClick={onLogout}
            variant="outline"
          >
            Odjavi me
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}