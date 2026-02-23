"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import GameBoard from "@/components/game/GameBoard";
import DonCounter from "@/components/game/DonCounter";
import LifeTracker from "@/components/game/LifeTracker";
import WebcamFeed from "@/components/video/WebcamFeed";
import CardRecognitionOverlay from "@/components/video/CardRecognitionOverlay";
import RecognitionPanel from "@/components/video/RecognitionPanel";
import { useCamera } from "@/hooks/useCamera";
import { useCardRecognition } from "@/hooks/useCardRecognition";
import { useGameState } from "@/hooks/useGameState";
import { Button } from "@/components/ui/button";
import type { PlayerBoard } from "@/types/game";

interface SoloGameClientProps {
  initialLocalBoard: PlayerBoard;
  opponentBoard: PlayerBoard;
}

export default function SoloGameClient({
  initialLocalBoard,
  opponentBoard,
}: SoloGameClientProps) {
  const router = useRouter();
  const camera = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognition = useCardRecognition();

  const {
    phase,
    turnNumber,
    nextPhase,
    donActive,
    donRested,
    donDeck,
    activateDon,
    restDon,
    unrestDon,
    lifeCards,
    revealLife,
    loseLife,
  } = useGameState(initialLocalBoard.leader?.life ?? 5);

  // Pipe camera stream into the hidden video element for card recognition
  useEffect(() => {
    if (videoRef.current && camera.stream) {
      videoRef.current.srcObject = camera.stream;
    }
  }, [camera.stream]);

  // Auto-start camera on mount
  useEffect(() => {
    void camera.startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveLocalBoard: PlayerBoard = {
    ...initialLocalBoard,
    donDeck,
    costArea: { active: donActive, rested: donRested },
    life: lifeCards.length,
  };

  const handleToggleRecognition = () => {
    if (recognition.state.isActive) {
      recognition.stop();
    } else {
      void recognition.start(videoRef);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <h1 className="text-lg font-bold text-white">Solo Test Mode</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/lobby")}
          className="min-h-[44px] border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700"
        >
          Back to Lobby
        </Button>
      </header>

      {/* Hidden video element for card recognition — positioned offscreen
          but with real dimensions so the browser decodes frames properly */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="pointer-events-none fixed -left-[9999px] -top-[9999px] h-[1px] w-[1px] opacity-0"
        aria-hidden="true"
      />

      {/* Main content: camera + board side by side on desktop, stacked on mobile */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left: Camera + Recognition */}
        <div className="flex flex-col border-b border-gray-800 lg:w-1/3 lg:border-b-0 lg:border-r">
          {/* Camera feed with recognition overlay */}
          <div className="relative aspect-video w-full bg-gray-900">
            <WebcamFeed
              stream={camera.stream}
              mirror={camera.settings.mirror}
              className="h-full w-full"
            />
            <CardRecognitionOverlay
              state={recognition.state}
              isActive={recognition.state.isActive}
              isUsingWorker={recognition.isUsingWorker}
              onToggle={handleToggleRecognition}
              videoWidth={videoRef.current?.videoWidth}
              videoHeight={videoRef.current?.videoHeight}
              mirror={camera.settings.mirror}
            />
          </div>

          {/* Recognition panel */}
          <RecognitionPanel
            lastResult={recognition.state.lastResult}
            topCandidates={recognition.state.topCandidates}
            className="border-t border-gray-800"
          />

          {/* Camera controls */}
          <div className="flex items-center gap-2 border-t border-gray-800 p-3">
            {camera.state === "idle" ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => void camera.startCamera()}
                className="min-h-[44px] bg-blue-600 hover:bg-blue-700"
              >
                Start Camera
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  recognition.stop();
                  camera.stopCamera();
                }}
                className="min-h-[44px] border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700"
              >
                Stop Camera
              </Button>
            )}
            <span className="text-xs text-gray-500">
              {camera.state === "active" && "Camera active"}
              {camera.state === "loading" && "Starting..."}
              {camera.state === "error" && (camera.error ?? "Camera error")}
              {camera.state === "idle" && "Camera off"}
            </span>
          </div>
        </div>

        {/* Right: Game Board */}
        <div className="flex flex-1 flex-col">
          <GameBoard
            localBoard={liveLocalBoard}
            opponentBoard={opponentBoard}
            localPlayerName="You (Solo)"
            opponentPlayerName="Bot"
            gamePhase={phase}
            turnNumber={turnNumber}
            isLocalTurn={true}
            onNextPhase={nextPhase}
          />

          {/* Interactive controls */}
          <div
            className="border-t border-gray-800 bg-gray-900 p-3"
            aria-label="Your interactive controls"
          >
            <div className="mx-auto flex max-w-2xl flex-col gap-3 md:flex-row md:gap-4">
              <div className="flex-1">
                <DonCounter
                  active={donActive}
                  rested={donRested}
                  deckRemaining={donDeck}
                  isInteractive={true}
                  onActivate={activateDon}
                  onRest={restDon}
                  onUnrest={unrestDon}
                />
              </div>
              <div className="flex-1">
                <LifeTracker
                  lifeCards={lifeCards}
                  isInteractive={true}
                  onReveal={revealLife}
                  onLoseLife={loseLife}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
