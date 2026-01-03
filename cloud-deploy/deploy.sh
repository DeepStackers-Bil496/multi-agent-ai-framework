#!/bin/bash
set -e

# ===========================================
# GCP Cloud Run AI Deployment Script
# Supports llama.cpp (CPU/GPU) and Ollama
# ===========================================

echo "=========================================="
echo "  GCP Cloud Run AI Deployment Script"
echo "=========================================="
echo ""

# Configuration - UPDATE THIS TO YOUR PROJECT ID
PROJECT_ID="${GCP_PROJECT_ID:-gen-lang-client-0345556791}"
REGION="${GCP_REGION:-us-central1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI not found. Install: sudo snap install google-cloud-cli --classic"
        exit 1
    fi
    
    if ! gcloud auth list 2>/dev/null | grep -q "ACTIVE"; then
        log_error "Not authenticated. Run: gcloud auth login"
        exit 1
    fi
    
    log_info "Prerequisites OK"
}

setup_project() {
    log_info "Setting up project: $PROJECT_ID"
    gcloud config set project "$PROJECT_ID"
    
    log_info "Enabling required APIs..."
    gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
}

create_artifact_registry() {
    local repo_name=$1
    log_info "Creating Artifact Registry: $repo_name"
    
    if ! gcloud artifacts repositories describe "$repo_name" --location="$REGION" &> /dev/null 2>&1; then
        gcloud artifacts repositories create "$repo_name" \
            --repository-format=docker \
            --location="$REGION"
    else
        log_info "Repository $repo_name already exists"
    fi
    
    gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
}

# =====================
# LLAMA.CPP CPU VERSION
# =====================
deploy_llama_cpu() {
    log_info "Deploying llama.cpp (CPU)..."
    
    local REPO="llama-repo"
    local SERVICE="llama-service"
    local IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/llama-server-cpu"
    
    create_artifact_registry "$REPO"
    
    log_info "Building Docker image..."
    cd "${SCRIPT_DIR}/llama-cpp-cpu"
    gcloud builds submit --tag "$IMAGE"
    
    log_info "Deploying to Cloud Run..."
    gcloud run deploy "$SERVICE" \
        --image "$IMAGE" \
        --region "$REGION" \
        --cpu 8 \
        --memory 32Gi \
        --timeout 3600 \
        --allow-unauthenticated \
        --port 8080 \
        --cpu-boost \
        --set-env-vars "MODEL_URL=${MODEL_URL:-}"
    
    SERVICE_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format="value(status.url)")
    log_info "llama.cpp (CPU) deployed at: $SERVICE_URL"
}

# =====================
# LLAMA.CPP GPU VERSION
# =====================
deploy_llama_gpu() {
    log_info "Deploying llama.cpp (GPU)..."
    
    local REPO="llama-repo"
    local SERVICE="llama-service-gpu"
    local IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/llama-server-gpu"
    
    create_artifact_registry "$REPO"
    
    log_info "Building Docker image..."
    cd "${SCRIPT_DIR}/llama-cpp"
    gcloud builds submit --tag "$IMAGE"
    
    log_info "Deploying to Cloud Run with GPU..."
    gcloud run deploy "$SERVICE" \
        --image "$IMAGE" \
        --region "$REGION" \
        --gpu 1 \
        --gpu-type nvidia-l4 \
        --cpu 4 \
        --memory 16Gi \
        --timeout 3600 \
        --no-cpu-throttling \
        --allow-unauthenticated \
        --port 8080 \
        --set-env-vars "MODEL_URL=${MODEL_URL:-}"
    
    SERVICE_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format="value(status.url)")
    log_info "llama.cpp (GPU) deployed at: $SERVICE_URL"
}

# =====================
# OLLAMA VERSION
# =====================
deploy_ollama() {
    log_info "Deploying Ollama..."
    
    local REPO="llama-repo"
    local SERVICE="ollama-service"
    local IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/ollama-server"
    
    create_artifact_registry "$REPO"
    
    log_info "Building Docker image..."
    cd "${SCRIPT_DIR}/ollama"
    gcloud builds submit --tag "$IMAGE"
    
    log_info "Deploying to Cloud Run..."
    gcloud run deploy "$SERVICE" \
        --image "$IMAGE" \
        --region "$REGION" \
        --cpu 8 \
        --memory 32Gi \
        --timeout 3600 \
        --allow-unauthenticated \
        --port 11434 \
        --cpu-boost \
        --set-env-vars "OLLAMA_MODEL=${OLLAMA_MODEL:-llama3.2:1b}"
    
    SERVICE_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format="value(status.url)")
    log_info "Ollama deployed at: $SERVICE_URL"
}

# =====================
# DELETE SERVICE
# =====================
delete_service() {
    echo ""
    echo "Current services:"
    gcloud run services list --region "$REGION" --format="table(SERVICE,URL)" 2>/dev/null || true
    echo ""
    read -p "Enter service name to delete: " service_name
    if [ -n "$service_name" ]; then
        gcloud run services delete "$service_name" --region "$REGION" --quiet
        log_info "Deleted $service_name"
    fi
}

# =====================
# MENU
# =====================
show_menu() {
    echo ""
    echo "Project: $PROJECT_ID"
    echo "Region:  $REGION"
    echo ""
    echo "Select deployment option:"
    echo "  1) llama.cpp CPU  (no GPU quota needed) ✓ TESTED"
    echo "  2) llama.cpp GPU  (requires GPU quota)"
    echo "  3) Ollama         (multi-model support)"
    echo "  4) Setup project & APIs only"
    echo "  5) Delete a service"
    echo "  6) List services"
    echo "  0) Exit"
    echo ""
    read -p "Enter choice [0-6]: " choice
}

list_services() {
    log_info "Current Cloud Run services:"
    gcloud run services list --region "$REGION" --format="table(SERVICE,URL,LAST_DEPLOYED)" 2>/dev/null || \
        log_warn "No services found"
}

# =====================
# MAIN
# =====================
check_prerequisites

case "${1:-menu}" in
    llama-cpu)
        setup_project
        deploy_llama_cpu
        ;;
    llama-gpu)
        setup_project
        deploy_llama_gpu
        ;;
    ollama)
        setup_project
        deploy_ollama
        ;;
    setup)
        setup_project
        ;;
    menu|*)
        show_menu
        case $choice in
            1) setup_project; deploy_llama_cpu ;;
            2) setup_project; deploy_llama_gpu ;;
            3) setup_project; deploy_ollama ;;
            4) setup_project ;;
            5) delete_service ;;
            6) list_services ;;
            0) exit 0 ;;
            *) log_error "Invalid option" ;;
        esac
        ;;
esac

echo ""
log_info "Done!"
