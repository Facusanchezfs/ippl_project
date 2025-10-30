import api from '../config/api';

export interface Post {
	id: string;
	title: string;
	slug: string;
	content: string;
	excerpt: string;
	section: string;
	status: 'draft' | 'published';
	thumbnail?: string;
	tags: string[];
	author: string;
	authorName: string;
	featured: boolean;
	readTime: string;
	views: number;
	likes: number;
	comments: {
		id: string;
		author: string;
		content: string;
		createdAt: string;
		status: string;
	}[];
	seo: {
		metaTitle: string;
		metaDescription: string;
		keywords: string;
	};
	createdAt: string;
	updatedAt: string;
	publishedAt?: string;
}

export type CreatePostDTO = Partial<Post>;

export interface PostsResponse {
	posts: Post[];
}

export interface PostResponse {
	post: Post;
}

interface ToggleLikeResponse {
	likes: number;
}
interface IncrementViewsResponse {
	views: number;
	isViewed: boolean;
}

class PostsService {
	async getAllPosts(): Promise<PostsResponse> {
		const res = await api.get<PostsResponse>('/posts');
		return res.data;
	}

	async getPostBySection(section: string): Promise<PostsResponse>{
		const res = await api.get<PostsResponse>(`/posts/${section}`)
		return res.data;
	}

	async createPost(postData: FormData): Promise<PostResponse> {
		const res = await api.post('/posts', postData);
		return res.data;
	}

	async updatePost(id: string, postData: FormData): Promise<Post> {
		const res = await api.put(`/posts/${id}`, postData);
		return res.data;
	}

	async deletePost(id: string): Promise<void> {
		await api.delete(`/posts/${id}`);
	}

	async getPostById(id: string): Promise<Post> {
		const res = await api.get(`/posts/${id}`);
		return res.data;
	}

	async toggleLike(id: string): Promise<ToggleLikeResponse> {
		const resp = await api.post<ToggleLikeResponse>(`/posts/${id}/toggle-like`);
		return resp.data;
	}

	async checkIfLiked(id: string): Promise<boolean> {
		const resp = await api.get<boolean>(`/posts/${id}/check-like`);
		return resp.data;
	}

	async checkIfViewed(id: string): Promise<boolean> {
		const resp = await api.get<boolean>(`/posts/${id}/check-view`);
		return resp.data;
	}

	async incrementViews(id: string): Promise<IncrementViewsResponse> {
		const resp = await api.post<IncrementViewsResponse>(
			`/posts/${id}/increment-view`
		);
		return resp.data;
	}

	async getPostBySlug(slug: string): Promise<Post> {
		const res = await api.get<PostResponse>(`/posts/slug/${slug}`);
		return res.data.post;
	}

	async likePost(id: string): Promise<Post> {
		const resp = await api.post<Post>(`/posts/${id}/toggle-like`);
		return resp.data;
	}

	async getStats() {
		const resp = await api.get('/stats');
		return resp.data;
	}
}

export default new PostsService();
