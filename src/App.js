import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as tf from '@tensorflow/tfjs';
import { useGameStorage } from './hooks/useGameStorage';
import { useModelStorage } from './hooks/useModelStorage';
import './App.css';

const MOVES = ['Rock', '🗿', 'Paper', '📄', 'Scissors', '✂️'];
const MOVE_NAMES = ['Rock', 'Paper', 'Scissors'];
const MAX_HISTORY = 50;
const TRAINING_BATCH_SIZE = 10;

const GameError = ({ message, onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
    <div className="flex items-center">
      <div className="text-red-400 mr-3">⚠️</div>
      <div>
        <h3 className="text-red-800 font-medium">Error</h3>
        <p className="text-red-600 text-sm mt-1">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  </div>
);

const LoadingSpinner = () => (
  <div className="flex items-center space-x-2">
    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
    <span className="text-sm text-gray-600">Initializing AI...</span>
  </div>
);

// Color variants must be statically defined for Tailwind JIT
const colorStyles = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-100', value: 'text-blue-600', label: 'text-blue-700' },
  green: { bg: 'bg-green-50', border: 'border-green-100', value: 'text-green-600', label: 'text-green-700' },
  red: { bg: 'bg-red-50', border: 'border-red-100', value: 'text-red-600', label: 'text-red-700' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-100', value: 'text-gray-600', label: 'text-gray-700' },
};

const StatCard = ({ label, value, color = "blue" }) => {
  const styles = colorStyles[color] || colorStyles.blue;
  return (
    <div className={`${styles.bg} border ${styles.border} rounded-lg p-4 text-center`}>
      <div className={`text-2xl font-bold ${styles.value}`}>{value}</div>
      <div className={`text-sm ${styles.label}`}>{label}</div>
    </div>
  );
};

const App = () => {
  const [playerMove, setPlayerMove] = useState(null);
  const [aiMove, setAiMove] = useState(null);
  const [message, setMessage] = useState('🎮 Choose your move to start!');
  const [model, setModel] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [aiStrategy, setAiStrategy] = useState('random');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [modelAccuracy, setModelAccuracy] = useState(0);
  const [modelStatus, setModelStatus] = useState('new'); // 'new', 'loaded', 'trained'
  
  // Add data persistence
  const { clearStorage } = useGameStorage(gameHistory, setGameHistory);
  
  // Add model persistence
  const { 
    saveModel, 
    loadModel, 
    deleteModel,
    isSaving, 
    isLoadingModel, 
    hasSavedModel, 
    lastSaved 
  } = useModelStorage();

  const createAdvancedModel = useCallback(() => {
    const sequenceModel = tf.sequential();
    
    // Input layer: sequence of last 5 moves + current game state
    sequenceModel.add(tf.layers.dense({ 
      inputShape: [15], // 5 moves × 3 dimensions each
      units: 128, 
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }));
    
    sequenceModel.add(tf.layers.dropout({ rate: 0.3 }));
    
    sequenceModel.add(tf.layers.dense({ 
      units: 64, 
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }));
    
    sequenceModel.add(tf.layers.dropout({ rate: 0.2 }));
    
    sequenceModel.add(tf.layers.dense({ 
      units: 32, 
      activation: 'relu' 
    }));
    
    // Output layer: probability distribution over 3 moves
    sequenceModel.add(tf.layers.dense({ 
      units: 3, 
      activation: 'softmax' 
    }));

    sequenceModel.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return sequenceModel;
  }, []);

  const initializeModel = useCallback(async (forceNew = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await tf.ready();
      
      let loadedModel = null;
      
      // Try to load a saved model first (unless forceNew is true)
      if (!forceNew) {
        try {
          loadedModel = await loadModel();
        } catch (err) {
          console.log('No saved model to load, creating new one');
        }
      }
      
      let activeModel;
      if (loadedModel) {
        activeModel = loadedModel;
        setModelStatus('loaded');
        setMessage('🧠 Loaded trained AI model! Choose Rock, Paper, or Scissors!');
      } else {
        activeModel = createAdvancedModel();
        setModelStatus('new');
        setMessage('🤖 AI ready! Choose Rock, Paper, or Scissors!');
        setModelAccuracy(0);
      }
      
      // Warm up the model with dummy data
      const dummyInput = tf.zeros([1, 15]);
      const warmup = activeModel.predict(dummyInput);
      warmup.dispose();
      dummyInput.dispose();
      
      setModel(activeModel);
    } catch (err) {
      console.error("Error initializing model:", err);
      setError("Failed to initialize AI model. Falling back to basic strategies.");
      setAiStrategy('random');
    } finally {
      setIsLoading(false);
    }
  }, [createAdvancedModel, loadModel]);

  // Initialize model on mount only
  useEffect(() => {
    initializeModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - only run on mount

  // Cleanup model on unmount
  useEffect(() => {
    return () => {
      if (model) {
        model.dispose();
      }
    };
  }, [model]);

  const getCounterMove = useCallback((move) => {
    const moveIndex = MOVE_NAMES.indexOf(move);
    return MOVE_NAMES[(moveIndex + 1) % 3]; // Rock -> Paper, Paper -> Scissors, Scissors -> Rock
  }, []);

  const encodeGameSequence = useCallback((history, currentMove) => {
    const sequence = new Array(15).fill(0); // 5 moves × 3 dimensions
    const recentMoves = history.slice(-5);
    
    recentMoves.forEach((game, idx) => {
      const playerIdx = MOVE_NAMES.indexOf(game.playerMove);
      const aiIdx = MOVE_NAMES.indexOf(game.aiMove);
      const resultIdx = game.result === 'win' ? 0 : game.result === 'loss' ? 1 : 2;
      
      if (playerIdx !== -1 && aiIdx !== -1) {
        sequence[idx * 3] = playerIdx / 2; // Normalize to 0-1
        sequence[idx * 3 + 1] = aiIdx / 2;
        sequence[idx * 3 + 2] = resultIdx / 2;
      }
    });
    
    return sequence;
  }, []);

  const predictNextMove = useCallback(async (history, currentMove) => {
    if (!model || history.length < 3) {
      return MOVE_NAMES[Math.floor(Math.random() * 3)];
    }

    let input = null;
    let prediction = null;
    
    try {
      const sequence = encodeGameSequence(history, currentMove);
      input = tf.tensor2d([sequence]);
      prediction = model.predict(input);
      const probabilities = await prediction.data();
      
      // Add some randomness to avoid being too predictable
      const randomFactor = 0.2;
      const adjustedProbs = probabilities.map((p) => 
        p * (1 - randomFactor) + (randomFactor / 3)
      );
      
      // Select move based on adjusted probabilities
      const predictedMoveIndex = adjustedProbs.indexOf(Math.max(...adjustedProbs));
      const predictedMove = MOVE_NAMES[predictedMoveIndex];
      
      // Return counter move to beat predicted player move
      return getCounterMove(predictedMove);
    } catch (err) {
      console.error("Prediction error:", err);
      return MOVE_NAMES[Math.floor(Math.random() * 3)];
    } finally {
      // Always dispose tensors to prevent memory leaks
      if (input) input.dispose();
      if (prediction) prediction.dispose();
    }
  }, [model, encodeGameSequence, getCounterMove]);

  const trainModel = useCallback(async (history) => {
    if (!model || history.length < TRAINING_BATCH_SIZE || isTraining) {
      return;
    }

    setIsTraining(true);
    
    try {
      const trainingData = history.slice(-TRAINING_BATCH_SIZE);
      const inputs = [];
      const labels = [];

      trainingData.forEach((game, idx) => {
        if (idx > 0) {
          const prevHistory = history.slice(0, history.indexOf(game));
          const sequence = encodeGameSequence(prevHistory, game.playerMove);
          const playerMoveIdx = MOVE_NAMES.indexOf(game.playerMove);
          
          if (playerMoveIdx !== -1) {
            inputs.push(sequence);
            const label = new Array(3).fill(0);
            label[playerMoveIdx] = 1;
            labels.push(label);
          }
        }
      });

      if (inputs.length > 0) {
        const xs = tf.tensor2d(inputs);
        const ys = tf.tensor2d(labels);
        
        const trainResult = await model.fit(xs, ys, {
          epochs: 3,
          batchSize: Math.min(inputs.length, 8),
          verbose: 0,
          validationSplit: 0.2
        });

        const accuracy = trainResult.history.acc || trainResult.history.accuracy;
        if (accuracy && accuracy.length > 0) {
          const newAccuracy = Math.round(accuracy[accuracy.length - 1] * 100);
          setModelAccuracy(newAccuracy);
          setModelStatus('trained');
          
          // Auto-save every 10 games when using learning mode
          if (history.length % 10 === 0 && history.length >= 10) {
            saveModel(model);
          }
        }

        xs.dispose();
        ys.dispose();
      }
    } catch (err) {
      console.error("Training error:", err);
    } finally {
      setIsTraining(false);
    }
  }, [model, encodeGameSequence, isTraining, saveModel]);

  const handlePlayerMove = useCallback(async (move) => {
    setPlayerMove(move);
    setMessage('🤔 AI is thinking...');
    
    let aiChoice;
    
    try {
      switch (aiStrategy) {
        case 'random':
          aiChoice = MOVE_NAMES[Math.floor(Math.random() * 3)];
          break;
          
        case 'counter':
          const lastPlayerMove = gameHistory.length > 0 
            ? gameHistory[gameHistory.length - 1].playerMove 
            : null;
          aiChoice = lastPlayerMove ? getCounterMove(lastPlayerMove) : MOVE_NAMES[Math.floor(Math.random() * 3)];
          break;
          
        case 'learning':
          aiChoice = await predictNextMove(gameHistory, move);
          break;
          
        case 'pattern':
          // Analyze last 3 moves for patterns
          if (gameHistory.length >= 3) {
            const lastThree = gameHistory.slice(-3).map(g => g.playerMove);
            const mostCommon = lastThree.reduce((a, b, _, arr) =>
              arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
            );
            aiChoice = getCounterMove(mostCommon);
          } else {
            aiChoice = MOVE_NAMES[Math.floor(Math.random() * 3)];
          }
          break;
          
        default:
          aiChoice = MOVE_NAMES[Math.floor(Math.random() * 3)];
      }
    } catch (err) {
      console.error("Error in AI decision:", err);
      aiChoice = MOVE_NAMES[Math.floor(Math.random() * 3)];
    }
    
    setAiMove(aiChoice);
    
    // Determine winner
    let result, resultMessage;
    if (move === aiChoice) {
      result = "tie";
      resultMessage = "It's a tie! 🤝";
    } else if (
      (move === 'Rock' && aiChoice === 'Scissors') ||
      (move === 'Scissors' && aiChoice === 'Paper') ||
      (move === 'Paper' && aiChoice === 'Rock')
    ) {
      result = "win";
      resultMessage = 'You win! 🎉';
    } else {
      result = "loss";
      resultMessage = 'AI wins! 🤖';
    }
    
    setMessage(resultMessage);
    
    // Update game history
    const newHistory = [...gameHistory, { 
      playerMove: move, 
      aiMove: aiChoice, 
      result,
      timestamp: new Date().toLocaleTimeString(),
      id: Date.now()
    }];
    
    // Limit history size
    const trimmedHistory = newHistory.length > MAX_HISTORY 
      ? newHistory.slice(-MAX_HISTORY) 
      : newHistory;
    
    setGameHistory(trimmedHistory);
    
    // Train model if using learning strategy
    if (aiStrategy === 'learning' && trimmedHistory.length >= 5) {
      setTimeout(() => trainModel(trimmedHistory), 100);
    }
  }, [aiStrategy, gameHistory, getCounterMove, predictNextMove, trainModel]);

  const stats = useMemo(() => {
    if (gameHistory.length === 0) return { wins: 0, losses: 0, ties: 0, winRate: 0 };
    
    return gameHistory.reduce((acc, game) => {
      if (game.result === 'win') acc.wins++;
      else if (game.result === 'loss') acc.losses++;
      else acc.ties++;
      return acc;
    }, { 
      wins: 0, 
      losses: 0, 
      ties: 0, 
      winRate: Math.round((gameHistory.filter(g => g.result === 'win').length / gameHistory.length) * 100) 
    });
  }, [gameHistory]);

  const strategyDescriptions = {
    random: "🎲 Completely random moves",
    counter: "🔄 Counters your last move",
    pattern: "🧠 Detects patterns in your play",
    learning: "🤖 Neural network learns your style"
  };

  if (error && !model) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <GameError message={error} onRetry={initializeModel} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {error && <GameError message={error} />}
        
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              🗿📄✂️ Rock Paper Scissors
            </h1>
            <p className="text-lg text-gray-600">AI-Powered Game with Machine Learning</p>
          </div>
          
          {isLoading && (
            <div className="flex justify-center mb-6">
              <LoadingSpinner />
            </div>
          )}
          
          <div className="text-center mb-6">
            <p className="text-xl font-medium text-gray-700 p-3 bg-gray-50 rounded-lg">
              {message}
            </p>
          </div>
          
          <div className="flex justify-center space-x-4 mb-6">
            {MOVE_NAMES.map((move, idx) => (
              <button
                key={move}
                onClick={() => handlePlayerMove(move)}
                disabled={isLoading}
                className="group flex flex-col items-center p-6 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <span className="text-4xl mb-2">{MOVES[idx * 2 + 1]}</span>
                <span className="text-lg font-medium">{move}</span>
              </button>
            ))}
          </div>
          
          {playerMove && aiMove && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="flex justify-center items-center space-x-8">
                <div className="text-center">
                  <div className="text-6xl mb-2">{MOVES[MOVE_NAMES.indexOf(playerMove) * 2 + 1]}</div>
                  <div className="text-lg font-medium text-gray-700">You chose</div>
                  <div className="text-xl font-bold text-blue-600">{playerMove}</div>
                </div>
                <div className="text-4xl">VS</div>
                <div className="text-center">
                  <div className="text-6xl mb-2">{MOVES[MOVE_NAMES.indexOf(aiMove) * 2 + 1]}</div>
                  <div className="text-lg font-medium text-gray-700">AI chose</div>
                  <div className="text-xl font-bold text-red-600">{aiMove}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📊 Game Statistics</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <StatCard label="Wins" value={stats.wins} color="green" />
              <StatCard label="Losses" value={stats.losses} color="red" />
              <StatCard label="Ties" value={stats.ties} color="gray" />
              <StatCard label="Win Rate" value={`${stats.winRate}%`} color="blue" />
            </div>
            
            {aiStrategy === 'learning' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-purple-700">AI Model Accuracy</span>
                  <span className="text-lg font-bold text-purple-600">{modelAccuracy}%</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-purple-600">
                    Status: {modelStatus === 'loaded' ? '📂 Loaded from storage' : 
                             modelStatus === 'trained' ? '🎓 Trained' : '🆕 New model'}
                  </span>
                </div>
                {isTraining && (
                  <div className="flex items-center mt-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-purple-600 mr-2"></div>
                    <span className="text-xs text-purple-600">Training...</span>
                  </div>
                )}
                {isSaving && (
                  <div className="flex items-center mt-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-green-600 mr-2"></div>
                    <span className="text-xs text-green-600">Saving model...</span>
                  </div>
                )}
                {lastSaved && !isSaving && (
                  <div className="text-xs text-gray-500 mt-2">
                    💾 Last saved: {new Date(lastSaved).toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">🤖 AI Strategy</h3>
            <div className="space-y-2 mb-4">
              {Object.entries(strategyDescriptions).map(([strategy, description]) => (
                <button
                  key={strategy}
                  onClick={() => setAiStrategy(strategy)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    aiStrategy === strategy
                      ? 'bg-purple-100 border-2 border-purple-300 text-purple-800'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium capitalize">{strategy}</div>
                  <div className="text-sm text-gray-600">{description}</div>
                </button>
              ))}
            </div>
            
            <div className="space-y-2">
              {aiStrategy === 'learning' && (
                <>
                  <button
                    onClick={() => saveModel(model)}
                    disabled={!model || isSaving || isTraining}
                    className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? '💾 Saving...' : '💾 Save Model'}
                  </button>
                  {hasSavedModel && (
                    <button
                      onClick={async () => {
                        await deleteModel();
                        initializeModel(true);
                      }}
                      disabled={isLoadingModel}
                      className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50"
                    >
                      🗑️ Delete Saved Model
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => initializeModel(true)}
                className="w-full px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                🔄 Reset AI Model
              </button>
              <button
                onClick={clearStorage}
                className="w-full px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                🗑️ Clear Game History
              </button>
            </div>
          </div>
        </div>

        {gameHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📚 Recent Game History</h3>
            <div className="max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {gameHistory.slice(-10).reverse().map((game) => (
                  <div key={game.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <span className="text-2xl">{MOVES[MOVE_NAMES.indexOf(game.playerMove) * 2 + 1]}</span>
                      <span className="text-sm text-gray-500">vs</span>
                      <span className="text-2xl">{MOVES[MOVE_NAMES.indexOf(game.aiMove) * 2 + 1]}</span>
                    </div>
                    <div className="text-center">
                      <span className={`font-bold ${
                        game.result === 'win' ? 'text-green-600' : 
                        game.result === 'loss' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {game.result === 'win' ? 'You Won!' : 
                         game.result === 'loss' ? 'AI Won!' : "Tie!"}
                      </span>
                      <div className="text-xs text-gray-500">{game.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;