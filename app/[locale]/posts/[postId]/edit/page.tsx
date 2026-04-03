import PostEditorScreen from '@/components/posts/PostEditorScreen';

interface EditGlobalPostPageProps {
  params: Promise<{postId: string}>;
}

export default async function EditGlobalPostPage({params}: EditGlobalPostPageProps) {
  const {postId} = await params;
  return <PostEditorScreen scope="global" postId={postId} />;
}
