// cpp/hnsw_wrapper.cpp
// C++ wrapper for hnswlib to expose C-compatible FFI interface

#include <cstdint>
#include <cstring>
#include <string>
#include <vector>
#include <stdexcept>
#include "hnswlib/hnswlib.h"

extern "C" {

// Space factory functions
void* hnsw_create_l2_space(int dim) {
    return new hnswlib::L2Space(dim);
}

void* hnsw_create_ip_space(int dim) {
    return new hnswlib::InnerProductSpace(dim);
}

void* hnsw_create_cosine_space(int dim) {
    return new hnswlib::InnerProductSpace(dim); // Cosine uses IP after normalization
}

void hnsw_free_space(void* space) {
    delete static_cast<hnswlib::SpaceInterface<float>*>(space);
}

// Index creation
void* hnsw_create_index(void* space, size_t maxElements, size_t M, size_t efConstruction, size_t randomSeed) {
    auto* s = static_cast<hnswlib::SpaceInterface<float>*>(space);
    return new hnswlib::HierarchicalNSW<float>(s, maxElements, M, efConstruction, randomSeed);
}

void hnsw_free_index(void* index) {
    delete static_cast<hnswlib::HierarchicalNSW<float>*>(index);
}

// Add elements
void hnsw_add_vector(void* index, const float* vector, size_t label, bool replaceDeleted) {
    auto* idx = static_cast<hnswlib::HierarchicalNSW<float>*>(index);
    idx->addPoint(vector, label, replaceDeleted);
}

// Search
void hnsw_search_knn(void* index, const float* query, size_t k,
                     size_t* out_labels, float* out_distances, size_t* out_count) {
    auto* idx = static_cast<hnswlib::HierarchicalNSW<float>*>(index);
    auto result = idx->searchKnn(query, k);

    size_t i = 0;
    for (auto& pair : result) {
        if (i >= k) break;
        out_distances[i] = pair.first;
        out_labels[i] = pair.second;
        i++;
    }
    *out_count = i;
}

// Mark delete
void hnsw_mark_delete(void* index, size_t label) {
    auto* idx = static_cast<hnswlib::HierarchicalNSW<float>*>(index);
    idx->markDelete(label);
}

// Resize
void hnsw_resize_index(void* index, size_t newMaxElements) {
    auto* idx = static_cast<hnswlib::HierarchicalNSW<float>*>(index);
    idx->resizeIndex(newMaxElements);
}

// Get element count
size_t hnsw_get_current_count(void* index) {
    auto* idx = static_cast<hnswlib::HierarchicalNSW<float>*>(index);
    return idx->getCurrentElementCount();
}

// Save/Load
void hnsw_save_index(void* index, const char* filename) {
    auto* idx = static_cast<hnswlib::HierarchicalNSW<float>*>(index);
    idx->saveIndex(filename);
}

void hnsw_load_index(void* index, const char* filename, void* space, size_t maxElements) {
    auto* idx = static_cast<hnswlib::HierarchicalNSW<float>*>(index);
    auto* s = static_cast<hnswlib::SpaceInterface<float>*>(space);
    idx->loadIndex(filename, s, maxElements);
}

// Set ef
void hnsw_set_ef(void* index, size_t ef) {
    auto* idx = static_cast<hnswlib::HierarchicalNSW<float>*>(index);
    idx->setEf(ef);
}

// Get distance function
float hnsw_get_distance(void* space, const float* a, const float* b) {
    auto* s = static_cast<hnswlib::SpaceInterface<float>*>(space);
    return s->get_dist_func()(a, b, s->get_dist_func_param());
}

} // extern "C"
