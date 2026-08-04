import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../lib/AuthProvider';
import { getSupabaseClient } from '../lib/supabase';
import { z } from 'zod';
import { gymWorkoutPlanSchema } from '../workout/gymSchemas';

// Define possible states
const STATES = {
    UNCONFIGURED: 'unconfigured',
    SIGNED_OUT: 'signed_out',
    LOADING: 'loading',
    ERROR: 'error',
    NO_SESSION: 'no_session',
    READY: 'ready',
    IN_PROGRESS: 'in_progress',
    CONFIRMED: 'confirmed',
    PROPOSAL_WAITING: 'proposal_waiting',
};

const TodayScreen = () => {
    const { user, loading: authLoading } = useAuth();
    const [state, setState] = useState(STATES.LOADING);
    const [plan, setPlan] = useState(null);
    const [execution, setExecution] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            if (authLoading) return;
            const client = getSupabaseClient();

            if (!client || !user) {
                setState(user ? STATES.NO_SESSION : STATES.SIGNED_OUT);
                return;
            }

            try {
                // Fetch active plan and execution
                const { data: planData, error: planError } = await client
                    .from('plans')
                    .select('id, plan_data')
                    .eq('scheduled_for', new Date().toISOString().split('T')[0])
                    .eq('plan_data->>kind', 'gym_workout')
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (planError) throw planError;
                const parsedPlan = gymWorkoutPlanSchema.safeParse(planData.plan_data);
                if (!parsedPlan.success) {
                    setState(STATES.ERROR);
                    return;
                }
                setPlan(parsedPlan.data);

                // Fetch latest execution
                const { data: executionData, error: execError } = await client
                    .from('workout_executions')
                    .select('id, status')
                    .eq('plan_id', planData.id)
                    .order('started_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (execError) throw execError;
                setExecution(executionData);

                // Determine the state
                if (!executionData) {
                    setState(STATES.READY);
                } else if (executionData.status === 'in_progress') {
                    setState(STATES.IN_PROGRESS);
                } else if (executionData.status === 'completed') {
                    setState(STATES.CONFIRMED);
                }
            } catch (error) {
                console.error(error);
                setState(STATES.ERROR);
            }
        };
        loadData();
    }, [authLoading, user]);

    const renderContent = () => {
        switch (state) {
            case STATES.LOADING:
                return <Text>Loading...</Text>;
            case STATES.ERROR:
                return <Text>Error loading data.</Text>;
            case STATES.READY:
                return <Text>Ready. You can start your workout soon!</Text>;
            case STATES.IN_PROGRESS:
                return <Text>Workout in progress!</Text>;
            case STATES.CONFIRMED:
                return <Text>Your workout has been confirmed!</Text>;
            case STATES.PROPOSAL_WAITING:
                return <Text>Nothing applied yet. Please review your proposal.</Text>;
            default:
                return <Text>Unknown state.</Text>;
        }
    };

    return <View>{renderContent()}</View>;
};

export default TodayScreen;
